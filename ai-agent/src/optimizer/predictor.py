"""Yield prediction model using machine learning."""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import TimeSeriesSplit
import structlog

logger = structlog.get_logger()


@dataclass
class YieldPrediction:
    """Yield prediction result."""
    strategy_id: str
    current_apy: float
    predicted_apy_7d: float
    predicted_apy_30d: float
    confidence: float
    trend: str  # "up", "down", "stable"
    factors: Dict[str, float]


class YieldPredictor:
    """Machine learning model for yield prediction."""

    def __init__(self, config: Dict[str, Any]):
        """Initialize yield predictor.

        Args:
            config: Configuration dictionary
        """
        self.config = config
        self.lookback_days = config.get("optimization", {}).get("lookback_days", 30)

        # Initialize models for each prediction horizon
        self.models = {
            "7d": GradientBoostingRegressor(
                n_estimators=100,
                max_depth=4,
                learning_rate=0.1,
                random_state=42
            ),
            "30d": RandomForestRegressor(
                n_estimators=100,
                max_depth=5,
                random_state=42
            )
        }

        self.scalers = {
            "7d": StandardScaler(),
            "30d": StandardScaler()
        }

        self._is_trained = False

    def prepare_features(
        self,
        historical_data: pd.DataFrame,
        market_data: Optional[Dict[str, Any]] = None
    ) -> pd.DataFrame:
        """Prepare features for prediction.

        Args:
            historical_data: Historical APY and TVL data
            market_data: Optional market data

        Returns:
            DataFrame with features
        """
        df = historical_data.copy()

        # Ensure we have required columns
        if "apy" not in df.columns:
            raise ValueError("historical_data must contain 'apy' column")

        # Time-based features
        if "date" in df.columns:
            df["date"] = pd.to_datetime(df["date"])
            df["day_of_week"] = df["date"].dt.dayofweek
            df["day_of_month"] = df["date"].dt.day

        # APY-based features
        df["apy_ma_7"] = df["apy"].rolling(window=7, min_periods=1).mean()
        df["apy_ma_14"] = df["apy"].rolling(window=14, min_periods=1).mean()
        df["apy_std_7"] = df["apy"].rolling(window=7, min_periods=1).std().fillna(0)

        # Momentum features
        df["apy_change_1d"] = df["apy"].diff().fillna(0)
        df["apy_change_7d"] = df["apy"].diff(7).fillna(0)

        # TVL features if available
        if "tvl" in df.columns:
            df["tvl_ma_7"] = df["tvl"].rolling(window=7, min_periods=1).mean()
            df["tvl_change_7d"] = df["tvl"].pct_change(7).fillna(0)

        # Market features if provided
        if market_data:
            df["price_change"] = market_data.get("price_change_24h", 0)
            df["volume"] = market_data.get("volume_24h", 0)

        # Fill any remaining NaN values
        df = df.fillna(0)

        return df

    def train(
        self,
        strategy_id: str,
        historical_data: pd.DataFrame,
        market_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, float]:
        """Train prediction models on historical data.

        Args:
            strategy_id: Strategy identifier
            historical_data: Historical data
            market_data: Optional market data

        Returns:
            Training metrics
        """
        logger.info("Training yield predictor", strategy=strategy_id)

        # Prepare features
        df = self.prepare_features(historical_data, market_data)

        # Define feature columns
        feature_cols = [
            "apy_ma_7", "apy_ma_14", "apy_std_7",
            "apy_change_1d", "apy_change_7d"
        ]

        if "tvl_ma_7" in df.columns:
            feature_cols.extend(["tvl_ma_7", "tvl_change_7d"])

        if "price_change" in df.columns:
            feature_cols.extend(["price_change", "volume"])

        # Ensure we have enough data
        min_samples = max(self.lookback_days, 14)
        if len(df) < min_samples:
            logger.warning(
                "Insufficient data for training",
                samples=len(df),
                required=min_samples
            )
            self._is_trained = False
            return {"error": "insufficient_data"}

        # Create target variables (future APY)
        df["target_7d"] = df["apy"].shift(-7)
        df["target_30d"] = df["apy"].shift(-30)

        # Remove rows with NaN targets
        df_train = df.dropna(subset=["target_7d", "target_30d"])

        if len(df_train) < 10:
            logger.warning("Not enough samples after target creation")
            self._is_trained = False
            return {"error": "insufficient_samples"}

        X = df_train[feature_cols].values
        y_7d = df_train["target_7d"].values
        y_30d = df_train["target_30d"].values

        # Scale features
        X_scaled_7d = self.scalers["7d"].fit_transform(X)
        X_scaled_30d = self.scalers["30d"].fit_transform(X)

        # Train models
        self.models["7d"].fit(X_scaled_7d, y_7d)
        self.models["30d"].fit(X_scaled_30d, y_30d)

        self._is_trained = True
        self._feature_cols = feature_cols

        # Calculate training scores
        score_7d = self.models["7d"].score(X_scaled_7d, y_7d)
        score_30d = self.models["30d"].score(X_scaled_30d, y_30d)

        logger.info(
            "Training complete",
            strategy=strategy_id,
            score_7d=score_7d,
            score_30d=score_30d
        )

        return {
            "r2_7d": score_7d,
            "r2_30d": score_30d,
            "samples": len(df_train)
        }

    def predict(
        self,
        strategy_id: str,
        current_data: pd.DataFrame,
        market_data: Optional[Dict[str, Any]] = None
    ) -> YieldPrediction:
        """Predict future yields.

        Args:
            strategy_id: Strategy identifier
            current_data: Recent historical data
            market_data: Optional market data

        Returns:
            YieldPrediction result
        """
        current_apy = float(current_data["apy"].iloc[-1]) if len(current_data) > 0 else 0.0

        if not self._is_trained:
            # Return simple prediction based on moving average
            return self._simple_prediction(strategy_id, current_data)

        # Prepare features
        df = self.prepare_features(current_data, market_data)

        # Get latest features
        X = df[self._feature_cols].iloc[-1:].values

        # Scale and predict
        X_scaled_7d = self.scalers["7d"].transform(X)
        X_scaled_30d = self.scalers["30d"].transform(X)

        pred_7d = float(self.models["7d"].predict(X_scaled_7d)[0])
        pred_30d = float(self.models["30d"].predict(X_scaled_30d)[0])

        # Calculate confidence based on recent volatility
        recent_std = df["apy"].tail(7).std()
        confidence = max(0.3, 1.0 - (recent_std * 10))  # Lower confidence with higher volatility

        # Determine trend
        trend = self._determine_trend(current_apy, pred_7d, pred_30d)

        # Get feature importances
        factors = self._get_feature_importance()

        return YieldPrediction(
            strategy_id=strategy_id,
            current_apy=current_apy,
            predicted_apy_7d=max(0, pred_7d),
            predicted_apy_30d=max(0, pred_30d),
            confidence=confidence,
            trend=trend,
            factors=factors
        )

    def _simple_prediction(
        self,
        strategy_id: str,
        current_data: pd.DataFrame
    ) -> YieldPrediction:
        """Simple prediction using moving averages.

        Args:
            strategy_id: Strategy identifier
            current_data: Recent historical data

        Returns:
            YieldPrediction result
        """
        if len(current_data) == 0:
            return YieldPrediction(
                strategy_id=strategy_id,
                current_apy=0.0,
                predicted_apy_7d=0.0,
                predicted_apy_30d=0.0,
                confidence=0.0,
                trend="stable",
                factors={}
            )

        current_apy = float(current_data["apy"].iloc[-1])
        ma_7 = float(current_data["apy"].tail(7).mean())
        ma_30 = float(current_data["apy"].mean())

        # Simple mean reversion prediction
        pred_7d = (current_apy + ma_7) / 2
        pred_30d = (current_apy + ma_30) / 2

        trend = self._determine_trend(current_apy, pred_7d, pred_30d)

        return YieldPrediction(
            strategy_id=strategy_id,
            current_apy=current_apy,
            predicted_apy_7d=pred_7d,
            predicted_apy_30d=pred_30d,
            confidence=0.5,  # Lower confidence for simple prediction
            trend=trend,
            factors={"moving_average": 1.0}
        )

    def _determine_trend(
        self,
        current: float,
        pred_7d: float,
        pred_30d: float
    ) -> str:
        """Determine yield trend.

        Args:
            current: Current APY
            pred_7d: 7-day prediction
            pred_30d: 30-day prediction

        Returns:
            Trend direction string
        """
        threshold = 0.005  # 0.5% change threshold

        short_term_change = (pred_7d - current) / current if current > 0 else 0
        long_term_change = (pred_30d - current) / current if current > 0 else 0

        if short_term_change > threshold and long_term_change > threshold:
            return "up"
        elif short_term_change < -threshold and long_term_change < -threshold:
            return "down"
        else:
            return "stable"

    def _get_feature_importance(self) -> Dict[str, float]:
        """Get feature importance from trained model.

        Returns:
            Dictionary of feature importances
        """
        if not self._is_trained:
            return {}

        importances = self.models["7d"].feature_importances_

        return {
            name: float(imp)
            for name, imp in zip(self._feature_cols, importances)
        }

    def generate_synthetic_history(
        self,
        base_apy: float,
        volatility: float,
        days: int = 60
    ) -> pd.DataFrame:
        """Generate synthetic historical data for training.

        Args:
            base_apy: Base APY value
            volatility: APY volatility
            days: Number of days to generate

        Returns:
            DataFrame with synthetic history
        """
        np.random.seed(42)

        dates = pd.date_range(
            end=datetime.utcnow(),
            periods=days,
            freq='D'
        )

        # Generate APY with mean reversion
        apy_values = [base_apy]
        for _ in range(1, days):
            # Mean reversion with noise
            mean_reversion = 0.1 * (base_apy - apy_values[-1])
            noise = np.random.normal(0, volatility * base_apy)
            new_apy = max(0, apy_values[-1] + mean_reversion + noise)
            apy_values.append(new_apy)

        # Generate correlated TVL
        tvl_base = 1000000
        tvl_values = [tvl_base]
        for i in range(1, days):
            # TVL somewhat correlated with APY
            apy_factor = 1 + (apy_values[i] - base_apy) * 2
            noise = np.random.normal(0, 0.02 * tvl_base)
            new_tvl = max(100000, tvl_values[-1] * apy_factor + noise)
            tvl_values.append(new_tvl)

        return pd.DataFrame({
            "date": dates,
            "apy": apy_values,
            "tvl": tvl_values
        })
