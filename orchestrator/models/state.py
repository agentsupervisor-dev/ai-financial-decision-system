from typing import TypedDict, Optional

class AnalysisState(TypedDict):
    ticker: str
    hurdle_rate: float

    forensic_report: Optional[str]
    macro_report: Optional[str]
    asymmetry_report: Optional[str]

    final_decision: Optional[str]