from typing import TypedDict, Optional


class HurdleComponents(TypedDict):
    inflation: float
    borrowing: float
    index_return: float
    opex: float
    alpha_target: float


class AnalysisState(TypedDict):
    ticker: str
    hurdle_components: HurdleComponents
    hurdle_rate: float
    investment_period: str

    forensic_report: Optional[str]
    macro_report: Optional[str]
    asymmetry_report: Optional[str]

    forensic_score: Optional[float]
    macro_score: Optional[float]
    asymmetry_score: Optional[float]

    composite_score: Optional[float]
    confidence: Optional[float]
    expected_return: Optional[float]
    clears_hurdle: Optional[bool]
    excess_return: Optional[float]

    final_decision: Optional[str]
    decision_summary: Optional[str]
