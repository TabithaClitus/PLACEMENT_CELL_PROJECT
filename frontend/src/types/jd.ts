export interface JDCriteria {
    company_name: string;
    job_role: string;
    batch: string;
    eligible_departments: string[];
    min_cgpa: number;
    min_10th_percent: number;
    min_12th_percent: number;
    min_diploma_percent: number;
    max_current_arrears: number;
    max_history_arrears: number;
    gender: string;
    salary_package: string;
    required_certifications: string[];
    allowed_status_keywords: string[];
    raw_text_preview?: string;
}

export interface EvaluatedStudent {
    reg_no: string;
    student_name: string;
    department: string;
    dept_code: string;
    batch: string;
    gender: string;
    ug_cgpa: number;
    twelfth_percent: number;
    diploma_percent: number;
    arrear_count: number;
    history_arrear: number;
    official_email: string;
    personal_email: string;
    mobile: string;
    undertaking: string;
    hosteller_dayscholar: string;
    // Placement Information
    is_placed: boolean;
    placed_company: string;
    salary_package: number;
    allowing_status: string;
    // Decision Outcomes
    is_eligible: boolean;
    is_ssg: boolean;
    status_code: "ELIGIBLE_UNPLACED" | "PLACED_ALLOWED" | "PLACED_NOT_ALLOWED" | "CRITERIA_MISMATCH";
    status_label: string;
    reason: string;
    failures: string[];
    // Certifications
    cisco: string;
    ai_navigate: string;
    oracle: string;
    maven_silicon: string;
    embedded: string;
    japanese: string;
    servicenow: string;
    any_one_cert: string;
}

export interface EvaluationSummary {
    total_evaluated: number;
    total_eligible: number;
    eligible_unplaced: number;
    placed_allowed: number;
    placed_not_allowed: number;
    criteria_mismatch: number;
    company_name: string;
    job_role: string;
}

export interface JDEvaluationResponse {
    summary: EvaluationSummary;
    criteria_applied: JDCriteria;
    students: EvaluatedStudent[];
}
