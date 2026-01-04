"""FastAPI server for yield optimization recommendations."""

from contextlib import asynccontextmanager
from decimal import Decimal
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import structlog
import yaml

from src.optimizer.agent import YieldOptimizerAgent

logger = structlog.get_logger()

# Global agent instance
agent: Optional[YieldOptimizerAgent] = None


# Request/Response Models
class OptimizationRequest(BaseModel):
    """Request for portfolio optimization."""
    amount: float = Field(..., gt=0, description="Amount to invest in USD")
    risk_tolerance: str = Field(
        default="moderate",
        pattern="^(conservative|moderate|aggressive)$",
        description="Risk tolerance level"
    )
    method: Optional[str] = Field(
        default=None,
        pattern="^(max_sharpe|min_variance|risk_parity|mean_variance)$",
        description="Optimization method"
    )


class AllocationResponse(BaseModel):
    """Portfolio allocation response."""
    strategy_id: str
    weight: float
    amount: float
    expected_apy: Optional[float] = None


class RiskResponse(BaseModel):
    """Risk assessment response."""
    overall_risk: str
    risk_score: float
    var_95: float
    max_drawdown: float
    warnings: List[str]
    recommendations: List[str]


class PredictionResponse(BaseModel):
    """Yield prediction response."""
    strategy: str
    current_apy: str
    predicted_7d: str
    predicted_30d: str
    trend: str
    confidence: str


class OptimizationResponse(BaseModel):
    """Complete optimization response."""
    timestamp: str
    investment_amount: float
    risk_tolerance: str
    recommended_allocation: Dict[str, AllocationResponse]
    expected_metrics: Dict[str, str]
    risk_assessment: RiskResponse
    yield_predictions: List[PredictionResponse]
    strategies: List[Dict[str, Any]]


class StrategyResponse(BaseModel):
    """Strategy information response."""
    id: str
    name: str
    type: str
    apy: float
    tvl: float
    risk_score: int
    sharpe_ratio: float


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    agent_running: bool
    last_optimization: Optional[str]
    optimization_count: int
    error_count: int


class UpdateAllocationsRequest(BaseModel):
    """Request to update current allocations."""
    allocations: Dict[str, float] = Field(
        ...,
        description="Current allocation weights by strategy ID"
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    global agent

    logger.info("Starting yield optimizer API")

    # Initialize agent
    agent = YieldOptimizerAgent()
    await agent.initialize()

    yield

    # Shutdown
    logger.info("Shutting down yield optimizer API")
    if agent:
        await agent.shutdown()


def create_app(config_path: str = "config.yaml") -> FastAPI:
    """Create and configure the FastAPI application.

    Args:
        config_path: Path to configuration file

    Returns:
        Configured FastAPI application
    """
    # Load config for CORS settings
    try:
        with open(config_path, "r") as f:
            config = yaml.safe_load(f)
    except Exception:
        config = {}

    api_config = config.get("api", {})
    cors_config = api_config.get("cors", {})

    app = FastAPI(
        title="CasperYield AI Optimizer",
        description="AI-powered yield optimization for Casper Network",
        version="1.0.0",
        lifespan=lifespan
    )

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_config.get("allow_origins", ["*"]),
        allow_credentials=True,
        allow_methods=cors_config.get("allow_methods", ["*"]),
        allow_headers=cors_config.get("allow_headers", ["*"]),
    )

    return app


# Create default app instance
app = create_app()


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Check API health and agent status."""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")

    state = agent.get_state()
    return HealthResponse(
        status="healthy",
        agent_running=state["is_running"],
        last_optimization=state["last_optimization"],
        optimization_count=state["optimization_count"],
        error_count=state["error_count"]
    )


@app.post("/optimize", response_model=OptimizationResponse, tags=["Optimization"])
async def optimize_portfolio(request: OptimizationRequest):
    """Get optimal portfolio allocation recommendation.

    This endpoint runs a complete optimization cycle including:
    - Fetching latest strategy data
    - Running yield predictions
    - Optimizing portfolio allocation
    - Assessing portfolio risk
    """
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")

    try:
        recommendation = await agent.get_recommendation(
            user_amount=Decimal(str(request.amount)),
            risk_tolerance=request.risk_tolerance
        )

        # Transform to response model
        allocations = {}
        for sid, data in recommendation["recommended_allocation"].items():
            # Find strategy info
            strategy_info = next(
                (s for s in recommendation["strategies"] if s["id"] == sid),
                {}
            )
            allocations[sid] = AllocationResponse(
                strategy_id=sid,
                weight=data["weight"],
                amount=data["amount"],
                expected_apy=strategy_info.get("apy")
            )

        risk = recommendation["risk_assessment"]
        result = agent.get_last_result()

        return OptimizationResponse(
            timestamp=recommendation["timestamp"],
            investment_amount=recommendation["investment_amount"],
            risk_tolerance=recommendation["risk_tolerance"],
            recommended_allocation=allocations,
            expected_metrics=recommendation["expected_metrics"],
            risk_assessment=RiskResponse(
                overall_risk=risk["overall_risk"],
                risk_score=risk["risk_score"],
                var_95=result["risk"]["var_95"] if result else 0,
                max_drawdown=result["risk"]["max_drawdown"] if result else 0,
                warnings=risk["warnings"],
                recommendations=risk["recommendations"]
            ),
            yield_predictions=[
                PredictionResponse(**p)
                for p in recommendation["yield_predictions"]
            ],
            strategies=recommendation["strategies"]
        )

    except Exception as e:
        logger.error("Optimization failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Optimization failed: {str(e)}")


@app.get("/strategies", response_model=List[StrategyResponse], tags=["Strategies"])
async def get_strategies():
    """Get all available yield strategies with current metrics."""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")

    try:
        result = agent.get_last_result()

        if not result:
            # Run optimization to get fresh data
            await agent.run_optimization()
            result = agent.get_last_result()

        if not result:
            raise HTTPException(status_code=404, detail="No strategy data available")

        return [
            StrategyResponse(**s)
            for s in result["strategies"]
        ]

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get strategies", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/strategies/{strategy_id}", response_model=StrategyResponse, tags=["Strategies"])
async def get_strategy(strategy_id: str):
    """Get details for a specific strategy."""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")

    try:
        result = agent.get_last_result()

        if not result:
            await agent.run_optimization()
            result = agent.get_last_result()

        if not result:
            raise HTTPException(status_code=404, detail="No strategy data available")

        strategy = next(
            (s for s in result["strategies"] if s["id"] == strategy_id),
            None
        )

        if not strategy:
            raise HTTPException(status_code=404, detail=f"Strategy {strategy_id} not found")

        return StrategyResponse(**strategy)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get strategy", strategy_id=strategy_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/allocation", tags=["Allocation"])
async def get_current_allocation():
    """Get current portfolio allocation."""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")

    state = agent.get_state()
    return {
        "allocations": state["current_allocations"],
        "last_optimization": state["last_optimization"]
    }


@app.post("/allocation", tags=["Allocation"])
async def update_allocation(request: UpdateAllocationsRequest):
    """Update current portfolio allocation after executing trades."""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")

    # Validate allocations sum to ~1
    total = sum(request.allocations.values())
    if not (0.99 <= total <= 1.01):
        raise HTTPException(
            status_code=400,
            detail=f"Allocations must sum to 1.0, got {total}"
        )

    await agent.update_allocations(request.allocations)

    return {"status": "updated", "allocations": request.allocations}


@app.get("/efficient-frontier", tags=["Analysis"])
async def get_efficient_frontier(
    points: int = Query(default=20, ge=5, le=50, description="Number of frontier points")
):
    """Get efficient frontier data for visualization."""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")

    try:
        # Fetch data and prepare input
        metrics = await agent.fetch_data()
        optimization_input = agent.data_processor.prepare_optimization_input(
            metrics,
            agent.state.current_allocations,
            Decimal("10000")
        )

        # Generate frontier
        frontier = agent.rebalancer.generate_efficient_frontier(
            optimization_input,
            num_points=points
        )

        return {"frontier": frontier}

    except Exception as e:
        logger.error("Failed to generate efficient frontier", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/risk-analysis", tags=["Analysis"])
async def get_risk_analysis():
    """Get detailed risk analysis for current or recommended portfolio."""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")

    try:
        result = agent.get_last_result()

        if not result:
            await agent.run_optimization()
            result = agent.get_last_result()

        if not result:
            raise HTTPException(status_code=404, detail="No analysis data available")

        return {
            "timestamp": result["timestamp"],
            "risk_level": result["risk"]["level"],
            "risk_score": result["risk"]["score"],
            "value_at_risk_95": result["risk"]["var_95"],
            "max_drawdown": result["risk"]["max_drawdown"],
            "portfolio_metrics": {
                "expected_return": result["allocation"]["expected_return"],
                "volatility": result["allocation"]["expected_volatility"],
                "sharpe_ratio": result["allocation"]["sharpe_ratio"]
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get risk analysis", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/predictions/{strategy_id}", tags=["Predictions"])
async def get_predictions(strategy_id: str):
    """Get yield predictions for a specific strategy."""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")

    try:
        # Get last result
        recommendation = await agent.get_recommendation(
            user_amount=Decimal("10000"),
            risk_tolerance="moderate"
        )

        prediction = next(
            (p for p in recommendation["yield_predictions"] if p["strategy"] == strategy_id),
            None
        )

        if not prediction:
            raise HTTPException(
                status_code=404,
                detail=f"No prediction available for strategy {strategy_id}"
            )

        return prediction

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get predictions", strategy_id=strategy_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/simulate", tags=["Simulation"])
async def simulate_portfolio(
    allocations: Dict[str, float],
    days: int = Query(default=30, ge=1, le=365, description="Simulation days")
):
    """Simulate portfolio performance with given allocations."""
    if not agent:
        raise HTTPException(status_code=503, detail="Agent not initialized")

    try:
        # Validate allocations
        total = sum(allocations.values())
        if not (0.99 <= total <= 1.01):
            raise HTTPException(
                status_code=400,
                detail=f"Allocations must sum to 1.0, got {total}"
            )

        # Get strategy metrics
        result = agent.get_last_result()
        if not result:
            await agent.run_optimization()
            result = agent.get_last_result()

        if not result:
            raise HTTPException(status_code=404, detail="No strategy data available")

        # Calculate expected performance
        total_return = 0
        total_volatility = 0

        for strategy_id, weight in allocations.items():
            strategy = next(
                (s for s in result["strategies"] if s["id"] == strategy_id),
                None
            )
            if strategy:
                total_return += weight * strategy["apy"]
                # Simplified volatility (would need correlation matrix for accurate calc)
                total_volatility += weight * 0.1  # Assume 10% base volatility

        # Project over simulation period
        period_return = total_return * (days / 365)

        return {
            "allocations": allocations,
            "simulation_days": days,
            "expected_return": {
                "annualized": f"{total_return:.2%}",
                "period": f"{period_return:.2%}"
            },
            "estimated_volatility": f"{total_volatility:.2%}",
            "projected_value": {
                "optimistic": 10000 * (1 + period_return + total_volatility),
                "expected": 10000 * (1 + period_return),
                "pessimistic": 10000 * (1 + period_return - total_volatility)
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Simulation failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
