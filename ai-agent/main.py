#!/usr/bin/env python3
"""
CasperYield AI Optimizer - Main Entry Point

This script starts the AI yield optimizer agent and REST API server.

Usage:
    python main.py                    # Run API server (default)
    python main.py --mode api         # Run API server
    python main.py --mode optimize    # Run single optimization
    python main.py --mode continuous  # Run continuous optimization loop
"""

import argparse
import asyncio
import sys
from decimal import Decimal
from pathlib import Path

import structlog
import uvicorn
import yaml

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from src.optimizer.agent import YieldOptimizerAgent


def setup_logging(level: str = "INFO"):
    """Configure structured logging.

    Args:
        level: Logging level
    """
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer()
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def load_config(config_path: str = "config.yaml") -> dict:
    """Load configuration from YAML file.

    Args:
        config_path: Path to configuration file

    Returns:
        Configuration dictionary
    """
    try:
        with open(config_path, "r") as f:
            return yaml.safe_load(f)
    except FileNotFoundError:
        print(f"Warning: Config file {config_path} not found, using defaults")
        return {}


async def run_single_optimization(
    config_path: str,
    amount: float = 10000,
    risk_tolerance: str = "moderate"
):
    """Run a single optimization and print results.

    Args:
        config_path: Path to configuration file
        amount: Investment amount
        risk_tolerance: Risk tolerance level
    """
    logger = structlog.get_logger()
    logger.info("Running single optimization", amount=amount, risk_tolerance=risk_tolerance)

    agent = YieldOptimizerAgent(config_path)

    try:
        await agent.initialize()

        recommendation = await agent.get_recommendation(
            user_amount=Decimal(str(amount)),
            risk_tolerance=risk_tolerance
        )

        # Print results
        print("\n" + "=" * 60)
        print("CASPERYIELD AI OPTIMIZER - RECOMMENDATION")
        print("=" * 60)
        print(f"\nTimestamp: {recommendation['timestamp']}")
        print(f"Investment Amount: ${recommendation['investment_amount']:,.2f}")
        print(f"Risk Tolerance: {recommendation['risk_tolerance']}")

        print("\n--- RECOMMENDED ALLOCATION ---")
        for strategy_id, data in recommendation['recommended_allocation'].items():
            print(f"  {strategy_id}: {data['weight']:.1%} (${data['amount']:,.2f})")

        print("\n--- EXPECTED METRICS ---")
        for metric, value in recommendation['expected_metrics'].items():
            print(f"  {metric}: {value}")

        print("\n--- RISK ASSESSMENT ---")
        risk = recommendation['risk_assessment']
        print(f"  Overall Risk: {risk['overall_risk']}")
        print(f"  Risk Score: {risk['risk_score']:.1f}/100")

        if risk['warnings']:
            print("\n  Warnings:")
            for w in risk['warnings']:
                print(f"    - {w}")

        if risk['recommendations']:
            print("\n  Recommendations:")
            for r in risk['recommendations']:
                print(f"    - {r}")

        print("\n--- YIELD PREDICTIONS ---")
        for pred in recommendation['yield_predictions']:
            print(f"  {pred['strategy']}:")
            print(f"    Current APY: {pred['current_apy']}")
            print(f"    7-Day Prediction: {pred['predicted_7d']} ({pred['trend']})")
            print(f"    Confidence: {pred['confidence']}")

        print("\n--- AVAILABLE STRATEGIES ---")
        for s in recommendation['strategies']:
            print(f"  {s['id']}: {s['name']}")
            print(f"    APY: {s['apy']:.2%} | TVL: ${s['tvl']:,.0f} | Risk: {s['risk_score']}/100")

        print("\n" + "=" * 60)

    except Exception as e:
        logger.error("Optimization failed", error=str(e))
        raise

    finally:
        await agent.shutdown()


async def run_continuous_optimization(config_path: str, interval_hours: int = 24):
    """Run continuous optimization loop.

    Args:
        config_path: Path to configuration file
        interval_hours: Hours between optimizations
    """
    logger = structlog.get_logger()
    logger.info("Starting continuous optimization", interval=interval_hours)

    agent = YieldOptimizerAgent(config_path)

    try:
        await agent.initialize()
        await agent.run_continuous(interval_hours=interval_hours)

    except KeyboardInterrupt:
        logger.info("Received shutdown signal")

    except Exception as e:
        logger.error("Continuous optimization failed", error=str(e))
        raise

    finally:
        await agent.shutdown()


def run_api_server(config_path: str):
    """Run the FastAPI server.

    Args:
        config_path: Path to configuration file
    """
    config = load_config(config_path)
    api_config = config.get("api", {})

    host = api_config.get("host", "0.0.0.0")
    port = api_config.get("port", 8000)
    debug = api_config.get("debug", False)

    print(f"\n{'=' * 60}")
    print("CASPERYIELD AI OPTIMIZER - API SERVER")
    print("=" * 60)
    print(f"\nStarting server at http://{host}:{port}")
    print(f"API Documentation: http://{host}:{port}/docs")
    print(f"Debug mode: {debug}")
    print("\nEndpoints:")
    print("  GET  /health              - Health check")
    print("  POST /optimize            - Get optimal allocation")
    print("  GET  /strategies          - List all strategies")
    print("  GET  /strategies/{id}     - Get strategy details")
    print("  GET  /allocation          - Get current allocation")
    print("  POST /allocation          - Update current allocation")
    print("  GET  /efficient-frontier  - Get efficient frontier")
    print("  GET  /risk-analysis       - Get risk analysis")
    print("  GET  /predictions/{id}    - Get yield predictions")
    print("  POST /simulate            - Simulate portfolio")
    print("=" * 60 + "\n")

    uvicorn.run(
        "src.api.server:app",
        host=host,
        port=port,
        reload=debug,
        log_level="info" if debug else "warning"
    )


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="CasperYield AI Optimizer",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py                          # Start API server
  python main.py --mode optimize          # Run single optimization
  python main.py --mode optimize -a 5000  # Optimize $5000
  python main.py --mode continuous        # Run continuous loop
        """
    )

    parser.add_argument(
        "--mode",
        "-m",
        choices=["api", "optimize", "continuous"],
        default="api",
        help="Running mode (default: api)"
    )

    parser.add_argument(
        "--config",
        "-c",
        default="config.yaml",
        help="Path to configuration file (default: config.yaml)"
    )

    parser.add_argument(
        "--amount",
        "-a",
        type=float,
        default=10000,
        help="Investment amount for optimization (default: 10000)"
    )

    parser.add_argument(
        "--risk",
        "-r",
        choices=["conservative", "moderate", "aggressive"],
        default="moderate",
        help="Risk tolerance level (default: moderate)"
    )

    parser.add_argument(
        "--interval",
        "-i",
        type=int,
        default=24,
        help="Hours between optimizations for continuous mode (default: 24)"
    )

    parser.add_argument(
        "--log-level",
        "-l",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        default="INFO",
        help="Logging level (default: INFO)"
    )

    args = parser.parse_args()

    # Setup logging
    setup_logging(args.log_level)

    # Run based on mode
    if args.mode == "api":
        run_api_server(args.config)

    elif args.mode == "optimize":
        asyncio.run(
            run_single_optimization(
                config_path=args.config,
                amount=args.amount,
                risk_tolerance=args.risk
            )
        )

    elif args.mode == "continuous":
        asyncio.run(
            run_continuous_optimization(
                config_path=args.config,
                interval_hours=args.interval
            )
        )


if __name__ == "__main__":
    main()
