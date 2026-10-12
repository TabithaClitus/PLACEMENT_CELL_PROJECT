import React, { useState, useMemo } from "react";
import {
    FileText,
    Upload,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Download,
    RefreshCw,
    Search,
    Filter,
    ChevronDown,
    Building2,
    Briefcase,
    GraduationCap,
    Sliders,
    Eye,
    X,
    FileSpreadsheet,
    FileUp,
    ShieldAlert,
    ShieldCheck,
    UserCheck,
    Award,
    Sparkles,
} from "lucide-react";
import { api } from "../api/client";
import { JDCriteria, EvaluatedStudent, EvaluationSummary, JDEvaluationResponse } from "../types/jd";

const DEFAULT_CRITERIA: JDCriteria = {
    company_name: "",
    job_role: "",
    batch: "",
    eligible_departments: [],
    min_cgpa: 0,
    min_10th_percent: 0,
    min_12th_percent: 0,
    min_diploma_percent: 0,
    max_current_arrears: 0,
    max_history_arrears: -1,
    gender: "ALL",
    salary_package: "",
    required_certifications: [],
    allowed_status_keywords: ["allowed", "allow", "yes", "eligible", "dream", "super dream"],
};

// All 21 college departments
export const ALL_COLLEGE_DEPARTMENTS: string[] = [
    "AGRI",
    "AIDS",
    "AIML",
    "BIOMEDICAL",
    "BIOTECHNOLOGY",
    "CIVIL",
    "CSBS",
    "CSE",
    "CSD",
    "CT",
    "ECE",
    "EEE",
    "EIE",
    "FASHION TECH",
    "FOOD TECH",
    "ISE",
    "IT",
    "MECHANICAL",
    "M.E - COMPUTER SCIENCE AND ENGINEERING",
    "M.E - INDUSTRIAL SAFETY ENGINEERING",
    "MBA - SCHOOL OF MANAGEMENT STUDIES",
];

// Department aliases for smart normalization and filtering
export const DEPARTMENT_ALIASES: Record<string, string[]> = {
    "AGRI": ["agri", "agriculture", "agricultural engineering", "agricultural"],
    "AIDS": ["aids", "ai&ds", "ai & ds", "artificial intelligence and data science", "artificial intelligence & data science", "ai and ds"],
    "AIML": ["aiml", "ai&ml", "ai & ml", "artificial intelligence and machine learning"],
    "BIOMEDICAL": ["biomedical", "biomedical engineering", "bme", "bm"],
    "BIOTECHNOLOGY": ["biotechnology", "biotech", "bt"],
    "CIVIL": ["civil", "civil engineering"],
    "CSBS": ["csbs", "computer science and business systems"],
    "CSE": ["cse", "computer science", "computer science and engineering", "cs"],
    "CSD": ["csd", "computer science and design", "cs & design"],
    "CT": ["ct", "computer technology"],
    "ECE": ["ece", "electronics and communication", "electronics and communication engineering", "electronics"],
    "EEE": ["eee", "electrical and electronics", "electrical and electronics engineering", "electrical"],
    "EIE": ["eie", "electronics and instrumentation", "electronics and instrumentation engineering"],
    "FASHION TECH": ["fashion tech", "fashion technology", "ft"],
    "FOOD TECH": ["food tech", "food technology"],
    "ISE": ["ise", "information science and engineering", "information science"],
    "IT": ["it", "information technology"],
    "MECHANICAL": ["mechanical", "mech", "mechanical engineering"],
    "M.E - COMPUTER SCIENCE AND ENGINEERING": ["m.e - computer science and engineering", "me cse", "m.e cse", "m.e. cse", "m.e - cse", "me-cse"],
    "M.E - INDUSTRIAL SAFETY ENGINEERING": ["m.e - industrial safety engineering", "me ise", "m.e ise", "m.e. ise", "industrial safety engineering", "industrial safety"],
    "MBA - SCHOOL OF MANAGEMENT STUDIES": ["mba - school of management studies", "mba", "school of management studies", "management studies"],
};

export const normalizeDept = (dept: string): string => {
    if (!dept) return "";
    const s = dept.trim().toLowerCase();
    
    // Ordered rules: specific disciplines first
    if (/m\.e\s*[-–/]?\s*cse\b|m\.e\s*[-–/]?\s*computer\s*science/i.test(s)) return "M.E - COMPUTER SCIENCE AND ENGINEERING";
    if (/m\.e\s*[-–/]?\s*industrial\s*safety|industrial\s*safety/i.test(s)) return "M.E - INDUSTRIAL SAFETY ENGINEERING";
    if (/\bmba\b|management\s*studies/i.test(s)) return "MBA - SCHOOL OF MANAGEMENT STUDIES";
    if (/\bcsbs\b|computer\s*science\s*(&|and)\s*business\s*systems|\bcs\s*(&|and|\/)\s*bs\b/i.test(s)) return "CSBS";
    if (/\bcsd\b|computer\s*science\s*(&|and)\s*design|\bcs\s*(&|and|\/)\s*d\b/i.test(s)) return "CSD";
    if (/\bct\b|computer\s*technology/i.test(s)) return "CT";
    if (/\baids\b|ai\s*(&|and|\/)\s*ds\b|artificial\s*intelligence\s*(&|and)\s*data\s*science|data\s*science/i.test(s)) return "AIDS";
    if (/\baiml\b|ai\s*(&|and|\/)\s*ml\b|artificial\s*intelligence\s*(&|and)\s*machine\s*learning/i.test(s)) return "AIML";
    if (/\bbiomedical\b|\bbme\b/i.test(s)) return "BIOMEDICAL";
    if (/\bbiotechnology\b|\bbiotech\b|\bbt\b/i.test(s)) return "BIOTECHNOLOGY";
    if (/fashion\s*tech|fashion\s*technology|\bft\b/i.test(s)) return "FASHION TECH";
    if (/food\s*tech|food\s*technology/i.test(s)) return "FOOD TECH";
    if (/\bise\b|information\s*science\s*(&|and)\s*engineering|information\s*science/i.test(s)) return "ISE";
    if (/\beie\b|electronics\s*(&|and)\s*instrumentation/i.test(s)) return "EIE";
    if (/\bece\b|electronics\s*(&|and)\s*communication/i.test(s)) return "ECE";
    if (/\beee\b|electrical\s*(&|and)\s*electronics/i.test(s)) return "EEE";
    if (/\bcse\b|computer\s*science\s*(&|and)\s*engineering|\bcomputer\s*science\b|computer\s*engineering/i.test(s)) return "CSE";
    if (/\bit\b|information\s*technology/i.test(s)) return "IT";
    if (/\bmech\b|mechanical\s*engineering|\bmechanical\b/i.test(s)) return "MECHANICAL";
    if (/\bcivil\b|civil\s*engineering/i.test(s)) return "CIVIL";
    if (/\bagri\b|agricultural\s*engineering|agriculture|agricultural/i.test(s)) return "AGRI";

    return dept.trim().toUpperCase();
};

export const isDeptMatch = (stuDept: string, stuDeptCode: string, targetDept: string): boolean => {
    if (!targetDept || targetDept === "ALL") return true;
    const targetCanon = normalizeDept(targetDept);
    const stuCanon = normalizeDept(stuDeptCode || stuDept);
    return targetCanon === stuCanon;
};

export const JDMatchingPage: React.FC = () => {
    // Files state
    const [studentsFile, setStudentsFile] = useState<File | null>(null);
    const [placedFile, setPlacedFile] = useState<File | null>(null);
    const [ssgFile, setSsgFile] = useState<File | null>(null);
    const [jdFile, setJdFile] = useState<File | null>(null);
    const [jdText, setJdText] = useState<string>("");
    const [jdInputMode, setJdInputMode] = useState<"file" | "text">("file");

    // Processing & Loading
    const [isParsingJD, setIsParsingJD] = useState<boolean>(false);
    const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

    // Criteria state
    const [criteria, setCriteria] = useState<JDCriteria>(DEFAULT_CRITERIA);
    const [isCriteriaEditable, setIsCriteriaEditable] = useState<boolean>(false);

    // Results state
    const [summary, setSummary] = useState<EvaluationSummary | null>(null);
    const [students, setStudents] = useState<EvaluatedStudent[]>([]);
    const [activeTab, setActiveTab] = useState<"ALL" | "ELIGIBLE" | "PLACED_ALLOWED" | "UNPLACED_ELIGIBLE" | "PLACED_NOT_ALLOWED" | "INELIGIBLE">("ELIGIBLE");

    // Table Filters
    const [searchTerm, setSearchTerm] = useState<string>("");
    const [selectedBatch, setSelectedBatch] = useState<string>("ALL");
    const [selectedDept, setSelectedDept] = useState<string>("ALL");
    const [selectedGender, setSelectedGender] = useState<string>("ALL");
    const [selectedAllowingStatus, setSelectedAllowingStatus] = useState<string>("ALL");
    const [selectedSSGFilter, setSelectedSSGFilter] = useState<"ALL" | "SSG_ONLY" | "NON_SSG">("ALL");
    const [selectedUndertaking, setSelectedUndertaking] = useState<string>("");
    const [selectedCertificate, setSelectedCertificate] = useState<string>("ALL");
    const [selectedArrearCount, setSelectedArrearCount] = useState<string>("");
    const [selectedHistoryArrear, setSelectedHistoryArrear] = useState<string>("");

    // Student Detail Modal
    const [selectedStudent, setSelectedStudent] = useState<EvaluatedStudent | null>(null);
    const [showRawText, setShowRawText] = useState<boolean>(false);
    const [sourceMode, setSourceMode] = useState<"custom" | "demo">("custom");

    const showNotify = (type: "success" | "error" | "info", message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 6000);
    };

    // Load sample demo datasets
    const handleLoadSampleData = async (notify: boolean = true) => {
        setIsEvaluating(true);
        try {
            const resp = await api.get("/api/jd/sample-data");
            const data: { sample_jd_text: string; criteria: JDCriteria; evaluation: JDEvaluationResponse } = resp.data;
            setJdText(data.sample_jd_text);
            setCriteria(data.criteria);
            setSummary(data.evaluation.summary);
            setStudents(data.evaluation.students);
            setSourceMode("demo");
            if (notify) {
                showNotify("success", "Loaded demo sample data with 8 candidates and sample Presidio JD!");
            }
        } catch (err: any) {
            console.error("Failed to load sample data:", err);
            if (notify) {
                showNotify("error", err?.response?.data?.detail || "Failed to load sample dataset.");
            }
        } finally {
            setIsEvaluating(false);
        }
    };

    // Reset to blank state
    const handleResetToBlank = () => {
        setStudentsFile(null);
        setPlacedFile(null);
        setSsgFile(null);
        setJdFile(null);
        setJdText("");
        setCriteria(DEFAULT_CRITERIA);
        setSummary(null);
        setStudents([]);
        setSelectedSSGFilter("ALL");
        setSourceMode("custom");
        showNotify("info", "Cleared all data. Upload your own files to begin.");
    };

    // Parse JD file or text
    const handleParseJD = async (fileOverride?: File) => {
        const fileToParse = fileOverride || jdFile;
        if (jdInputMode === "file" && !fileToParse) {
            showNotify("error", "Please choose a Job Description file (.pdf, .docx, .txt).");
            return;
        }
        if (jdInputMode === "text" && !jdText.trim()) {
            showNotify("error", "Please paste the Job Description text.");
            return;
        }

        setIsParsingJD(true);
        try {
            const formData = new FormData();
            if (jdInputMode === "file" && fileToParse) {
                formData.append("file", fileToParse);
            } else {
                formData.append("text", jdText);
            }

            const resp = await api.post("/api/jd/parse-jd", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            const parsedCriteria: JDCriteria = resp.data.criteria;
            setCriteria(parsedCriteria);
            setSourceMode("custom");
            if (resp.data.extracted_text) {
                setJdText(resp.data.extracted_text);
            }

            if (resp.data.is_empty) {
                showNotify("info", resp.data.message);
            } else {
                const cName = parsedCriteria.company_name ? `"${parsedCriteria.company_name}"` : "JD";
                const cgpaInfo = parsedCriteria.min_cgpa ? `, Min CGPA: ${parsedCriteria.min_cgpa}` : "";
                const arrInfo = parsedCriteria.max_current_arrears === 0 ? ", 0 Standing Arrears" : "";
                showNotify(
                    "success",
                    `Extracted criteria from ${fileToParse?.name || 'text'}! (${cName}${cgpaInfo}${arrInfo})`
                );
            }
        } catch (err: any) {
            showNotify("error", err?.response?.data?.detail || "Failed to parse Job Description.");
        } finally {
            setIsParsingJD(false);
        }
    };

    // Evaluate students against criteria
    const handleEvaluate = async () => {
        setIsEvaluating(true);
        try {
            const formData = new FormData();
            if (studentsFile) {
                formData.append("students_file", studentsFile);
            }
            if (placedFile) {
                formData.append("placed_file", placedFile);
            }
            if (ssgFile) {
                formData.append("ssg_file", ssgFile);
            }
            if (jdFile) {
                formData.append("jd_file", jdFile);
            }
            formData.append("criteria_json", JSON.stringify(criteria));

            const resp = await api.post("/api/jd/evaluate", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            const resData: JDEvaluationResponse = resp.data;
            setSummary(resData.summary);
            setStudents(resData.students);
            showNotify(
                "success",
                `Evaluation complete: ${resData.summary.total_eligible} out of ${resData.summary.total_evaluated} students are eligible!`
            );
        } catch (err: any) {
            showNotify("error", err?.response?.data?.detail || "Evaluation failed.");
        } finally {
            setIsEvaluating(false);
        }
    };

    // Export styled Excel
    const handleExportExcel = async () => {
        if (!students.length) {
            showNotify("error", "No evaluated students to export.");
            return;
        }
        setIsExporting(true);
        try {
            const payload = {
                summary: summary || {},
                criteria_applied: criteria,
                students: filteredStudents,
            };
            const resp = await api.post("/api/jd/export-excel", payload, {
                responseType: "blob",
            });

            const url = window.URL.createObjectURL(new Blob([resp.data]));
            const link = document.createElement("a");
            link.href = url;
            const company = (criteria.company_name || "Placement").replace(/[^a-zA-Z0-9]/g, "_");
            link.setAttribute("download", `${company}_Eligible_Candidates.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            showNotify("success", "Excel export downloaded successfully!");
        } catch (err) {
            showNotify("error", "Failed to export Excel.");
        } finally {
            setIsExporting(false);
        }
    };

    // Download templates
    const handleDownloadTemplate = async (templateType: "student_master" | "placed_students") => {
        try {
            const resp = await api.get(`/api/jd/download-template/${templateType}`, {
                responseType: "blob",
            });
            const url = window.URL.createObjectURL(new Blob([resp.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute(
                "download",
                templateType === "student_master" ? "Student_Master_Template.xlsx" : "Placed_Students_Template.xlsx"
            );
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            showNotify("error", "Failed to download template.");
        }
    };

    // Extract dynamic filter options
    const availableBatches = useMemo(() => {
        const set = new Set<string>();
        students.forEach((s) => s.batch && set.add(s.batch));
        return Array.from(set).sort();
    }, [students]);

    const availableDepts = useMemo(() => {
        const list = [...ALL_COLLEGE_DEPARTMENTS];
        students.forEach((s) => {
            if (s.department && !list.includes(s.department.toUpperCase())) {
                list.push(s.department);
            }
        });
        return list;
    }, [students]);

    const availableAllowingStatuses = useMemo(() => {
        const set = new Set<string>();
        students.forEach((s) => s.allowing_status && set.add(s.allowing_status));
        return Array.from(set).sort();
    }, [students]);

    // Filter students
    const filteredStudents = useMemo(() => {
        return students.filter((stu) => {
            // Tab filter
            if (activeTab === "ELIGIBLE" && !stu.is_eligible) return false;
            if (activeTab === "PLACED_ALLOWED" && stu.status_code !== "PLACED_ALLOWED") return false;
            if (activeTab === "UNPLACED_ELIGIBLE" && stu.status_code !== "ELIGIBLE_UNPLACED") return false;
            if (activeTab === "PLACED_NOT_ALLOWED" && stu.status_code !== "PLACED_NOT_ALLOWED") return false;
            if (activeTab === "INELIGIBLE" && stu.is_eligible) return false;

            // Batch filter
            if (selectedBatch !== "ALL" && stu.batch !== selectedBatch) return false;

            // Dept filter (All 21 departments supported)
            if (selectedDept !== "ALL" && !isDeptMatch(stu.department, stu.dept_code, selectedDept)) return false;

            // Gender filter
            if (selectedGender !== "ALL" && stu.gender !== selectedGender) return false;

            // Allowing Status filter
            if (selectedAllowingStatus !== "ALL" && stu.allowing_status !== selectedAllowingStatus) return false;

            // Undertaking filter (typeable text filter)
            if (selectedUndertaking.trim() !== "") {
                const term = selectedUndertaking.trim().toLowerCase();
                const undertakingVal = (stu.undertaking || "").toLowerCase();
                if (!undertakingVal.includes(term)) return false;
            }

            // Certificate filter
            if (selectedCertificate !== "ALL") {
                const isCertPassed = (val?: string) => {
                    if (!val) return false;
                    const lower = val.toLowerCase().trim();
                    return lower === "yes" || lower === "completed" || lower === "y" || lower === "1" || (lower !== "no" && lower !== "0" && lower !== "");
                };

                if (selectedCertificate === "ANY") {
                    const hasAny = isCertPassed(stu.cisco) ||
                        isCertPassed(stu.ai_navigate) ||
                        isCertPassed(stu.oracle) ||
                        isCertPassed(stu.maven_silicon) ||
                        isCertPassed(stu.embedded) ||
                        isCertPassed(stu.japanese) ||
                        isCertPassed(stu.servicenow) ||
                        isCertPassed(stu.any_one_cert);
                    if (!hasAny) return false;
                } else if (selectedCertificate === "CISCO" && !isCertPassed(stu.cisco)) {
                    return false;
                } else if (selectedCertificate === "AI_NAVIGATE" && !isCertPassed(stu.ai_navigate)) {
                    return false;
                } else if (selectedCertificate === "ORACLE" && !isCertPassed(stu.oracle)) {
                    return false;
                } else if (selectedCertificate === "MAVEN_SILICON" && !isCertPassed(stu.maven_silicon)) {
                    return false;
                } else if (selectedCertificate === "EMBEDDED" && !isCertPassed(stu.embedded)) {
                    return false;
                } else if (selectedCertificate === "JAPANESE" && !isCertPassed(stu.japanese)) {
                    return false;
                } else if (selectedCertificate === "SERVICENOW" && !isCertPassed(stu.servicenow)) {
                    return false;
                }
            }

            // Current Standing Arrear Count filter (int threshold: stu <= entered_max)
            if (selectedArrearCount.trim() !== "") {
                const maxA = parseInt(selectedArrearCount, 10);
                if (!isNaN(maxA) && stu.arrear_count > maxA) return false;
            }

            // History of Arrear filter (int threshold: stu <= entered_max)
            if (selectedHistoryArrear.trim() !== "") {
                const maxH = parseInt(selectedHistoryArrear, 10);
                if (!isNaN(maxH) && stu.history_arrear > maxH) return false;
            }

            // SSG Student filter
            if (selectedSSGFilter === "SSG_ONLY" && !stu.is_ssg) return false;
            if (selectedSSGFilter === "NON_SSG" && stu.is_ssg) return false;

            // Search filter
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const matched =
                    stu.reg_no.toLowerCase().includes(term) ||
                    stu.student_name.toLowerCase().includes(term) ||
                    stu.department.toLowerCase().includes(term) ||
                    stu.official_email.toLowerCase().includes(term) ||
                    stu.placed_company.toLowerCase().includes(term) ||
                    stu.allowing_status.toLowerCase().includes(term);
                if (!matched) return false;
            }

            return true;
        });
    }, [
        students,
        activeTab,
        selectedBatch,
        selectedDept,
        selectedGender,
        selectedAllowingStatus,
        selectedSSGFilter,
        selectedUndertaking,
        selectedCertificate,
        selectedArrearCount,
        selectedHistoryArrear,
        searchTerm,
    ]);

    // Active filters count
    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (searchTerm.trim()) count++;
        if (selectedBatch !== "ALL") count++;
        if (selectedDept !== "ALL") count++;
        if (selectedGender !== "ALL") count++;
        if (selectedAllowingStatus !== "ALL") count++;
        if (selectedSSGFilter !== "ALL") count++;
        if (selectedUndertaking.trim() !== "") count++;
        if (selectedCertificate !== "ALL") count++;
        if (selectedArrearCount.trim() !== "") count++;
        if (selectedHistoryArrear.trim() !== "") count++;
        return count;
    }, [
        searchTerm,
        selectedBatch,
        selectedDept,
        selectedGender,
        selectedAllowingStatus,
        selectedSSGFilter,
        selectedUndertaking,
        selectedCertificate,
        selectedArrearCount,
        selectedHistoryArrear,
    ]);

    const handleResetFilters = () => {
        setSearchTerm("");
        setSelectedBatch("ALL");
        setSelectedDept("ALL");
        setSelectedGender("ALL");
        setSelectedAllowingStatus("ALL");
        setSelectedSSGFilter("ALL");
        setSelectedUndertaking("");
        setSelectedCertificate("ALL");
        setSelectedArrearCount("");
        setSelectedHistoryArrear("");
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Top Notification */}
            {notification && (
                <div
                    className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center space-x-3 text-sm font-medium transition-all ${
                        notification.type === "success"
                            ? "bg-emerald-600 text-white"
                            : notification.type === "error"
                            ? "bg-rose-600 text-white"
                            : "bg-indigo-600 text-white"
                    }`}
                >
                    {notification.type === "success" && <CheckCircle2 className="w-5 h-5 shrink-0" />}
                    {notification.type === "error" && <XCircle className="w-5 h-5 shrink-0" />}
                    {notification.type === "info" && <AlertCircle className="w-5 h-5 shrink-0" />}
                    <span>{notification.message}</span>
                </div>
            )}

            {/* Header Banner */}
            <div className="bg-gradient-to-r from-indigo-50 via-white to-purple-50 dark:from-indigo-900/60 dark:via-slate-900 dark:to-purple-950/60 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl p-6 shadow-sm dark:shadow-none backdrop-blur-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 w-96 h-full bg-gradient-to-l from-indigo-100/40 dark:from-indigo-500/10 to-transparent pointer-events-none" />
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                    <div>
                        <div className="flex items-center space-x-2.5">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30">
                                Admin Smart Filter
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">Deterministic Eligibility Engine</span>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
                            JD Candidate Selection & Allowing Status Resolver
                        </h1>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-3xl">
                            Upload your <span className="text-indigo-600 dark:text-indigo-400 font-semibold">Student Master Excel</span>,{" "}
                            <span className="text-purple-600 dark:text-purple-400 font-semibold">Placed Offers Excel</span>, and{" "}
                            <span className="text-cyan-600 dark:text-cyan-400 font-semibold">JD (PDF/Word)</span>. The system auto-extracts criteria, matches eligibility, and evaluates placed students against their{" "}
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Allowing Status</span>.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        <div className="flex space-x-1.5">
                            <button
                                onClick={() => handleDownloadTemplate("student_master")}
                                title="Download sample student master template with all 25 columns"
                                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm transition-all"
                            >
                                <Download className="w-3.5 h-3.5 text-slate-400" />
                                <span>Student Template</span>
                            </button>
                            <button
                                onClick={() => handleDownloadTemplate("placed_students")}
                                title="Download sample placed student template with Allowing Status and proofs"
                                className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm transition-all"
                            >
                                <Download className="w-3.5 h-3.5 text-slate-400" />
                                <span>Placed Template</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* JD Text View Toggle */}
            {(jdText || criteria.company_name) && (
                <div className="flex items-center justify-between text-xs px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center space-x-2">
                        {criteria.company_name && (
                            <span className="text-slate-700 dark:text-slate-300">
                                Targeted Company: <strong className="text-cyan-600 dark:text-cyan-400">{criteria.company_name}</strong>
                            </span>
                        )}
                    </div>
                    {jdText && (
                        <button
                            onClick={() => setShowRawText(!showRawText)}
                            className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 flex items-center space-x-1 font-medium transition-all"
                        >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{showRawText ? "Hide Extracted JD Text" : "View Extracted JD Text"}</span>
                        </button>
                    )}
                </div>
            )}

            {/* Expandable Raw JD Text Preview */}
            {showRawText && jdText && (
                <div className="bg-white dark:bg-slate-950 border border-cyan-400/40 dark:border-cyan-500/30 rounded-2xl p-4 shadow-xl text-xs">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-2">
                        <div className="flex items-center space-x-2">
                            <FileText className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                            <span className="font-semibold text-slate-900 dark:text-white">Raw Extracted Text from Job Description:</span>
                            <span className="text-[11px] text-slate-500 font-mono">({jdText.length} characters)</span>
                        </div>
                        <button
                            onClick={() => setShowRawText(false)}
                            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <pre className="font-mono text-slate-800 dark:text-slate-300 whitespace-pre-wrap max-h-60 overflow-y-auto p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] leading-relaxed">
                        {jdText}
                    </pre>
                </div>
            )}

            {/* Step 1: Upload Files Grid (4 Cards) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Student Master Excel */}
                <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 shadow-sm transition-all">
                    <div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2.5">
                                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                                    <FileSpreadsheet className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm">1. Student Master Sheet</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">25 columns (CGPA, Arrears...)</p>
                                </div>
                            </div>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                Excel (.xlsx)
                            </span>
                        </div>

                        <div className="mt-4 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500/50 rounded-xl p-4 text-center cursor-pointer relative bg-slate-50/70 dark:bg-slate-950/40 transition-all">
                            <input
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={(e) => {
                                    const f = e.target.files?.[0] || null;
                                    setStudentsFile(f);
                                    if (f) setSourceMode("custom");
                                }}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                            <FileUp className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                {studentsFile ? studentsFile.name : "Choose or drag Student Excel"}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Reg No, Name, Dept, CGPA, Arrears
                            </p>
                        </div>

                        {studentsFile && (
                            <div className="mt-2.5 flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-medium">
                                <span className="truncate max-w-[180px]">{studentsFile.name}</span>
                                <span className="shrink-0 text-[10px]">{(studentsFile.size / 1024).toFixed(1)} KB</span>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>Status:</span>
                        <span className={studentsFile ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-slate-400 dark:text-slate-500"}>
                            {studentsFile ? "Uploaded Custom Sheet" : "Using Demo Master Sheet"}
                        </span>
                    </div>
                </div>

                {/* 2. Placed Students / Offer Excel */}
                <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 shadow-sm transition-all">
                    <div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2.5">
                                <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20">
                                    <Building2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm">2. Placed / Offers Sheet</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Allowing Status & Offers</p>
                                </div>
                            </div>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                Excel (.xlsx)
                            </span>
                        </div>

                        <div className="mt-4 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-purple-400 dark:hover:border-purple-500/50 rounded-xl p-4 text-center cursor-pointer relative bg-slate-50/70 dark:bg-slate-950/40 transition-all">
                            <input
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={(e) => {
                                    const f = e.target.files?.[0] || null;
                                    setPlacedFile(f);
                                    if (f) setSourceMode("custom");
                                }}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                            <FileUp className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                {placedFile ? placedFile.name : "Choose or drag Placed Excel"}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Reg No, Company, Allowing Status
                            </p>
                        </div>

                        {placedFile && (
                            <div className="mt-2.5 flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-medium">
                                <span className="truncate max-w-[180px]">{placedFile.name}</span>
                                <span className="shrink-0 text-[10px]">{(placedFile.size / 1024).toFixed(1)} KB</span>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>Status:</span>
                        <span className={placedFile ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-slate-400 dark:text-slate-500"}>
                            {placedFile ? "Uploaded Custom Offers" : "Using Demo Placed Sheet"}
                        </span>
                    </div>
                </div>

                {/* 3. SSG Students Sheet (Optional) */}
                <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 shadow-sm transition-all">
                    <div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2.5">
                                <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                                    <UserCheck className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm">3. SSG Students Sheet</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Name & Reg No</p>
                                </div>
                            </div>
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                                Optional (.xlsx)
                            </span>
                        </div>

                        <div className="mt-4 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-500/50 rounded-xl p-4 text-center cursor-pointer relative bg-slate-50/70 dark:bg-slate-950/40 transition-all">
                            <input
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={(e) => {
                                    const f = e.target.files?.[0] || null;
                                    setSsgFile(f);
                                }}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                            <FileUp className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                            <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                {ssgFile ? ssgFile.name : "Choose or drag SSG Excel"}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Reg No & Student Name columns
                            </p>
                        </div>

                        {ssgFile && (
                            <div className="mt-2.5 flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400 font-medium">
                                <span className="truncate max-w-[180px]">{ssgFile.name}</span>
                                <span className="shrink-0 text-[10px]">{(ssgFile.size / 1024).toFixed(1)} KB</span>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>Status:</span>
                        <span className={ssgFile ? "text-amber-600 dark:text-amber-400 font-medium" : "text-slate-400 dark:text-slate-500"}>
                            {ssgFile ? "Uploaded SSG List" : "None (Optional)"}
                        </span>
                    </div>
                </div>

                {/* 4. Job Description Document / Text */}
                <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 shadow-sm transition-all">
                    <div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2.5">
                                <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm">4. Job Description (JD)</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Auto-Extracts on Upload</p>
                                </div>
                            </div>

                            <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700">
                                <button
                                    onClick={() => setJdInputMode("file")}
                                    className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all ${
                                        jdInputMode === "file" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                    }`}
                                >
                                    File
                                </button>
                                <button
                                    onClick={() => setJdInputMode("text")}
                                    className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all ${
                                        jdInputMode === "text" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                    }`}
                                >
                                    Text
                                </button>
                            </div>
                        </div>

                        {jdInputMode === "file" ? (
                            <div className="mt-4 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-cyan-400 dark:hover:border-cyan-500/50 rounded-xl p-4 text-center cursor-pointer relative bg-slate-50/70 dark:bg-slate-950/40 transition-all">
                                <input
                                    type="file"
                                    accept=".pdf,.docx,.doc,.txt"
                                    onChange={(e) => {
                                        const f = e.target.files?.[0] || null;
                                        if (f) {
                                            setJdFile(f);
                                            handleParseJD(f);
                                        }
                                    }}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                />
                                {isParsingJD ? (
                                    <div className="py-2">
                                        <RefreshCw className="w-6 h-6 text-cyan-600 dark:text-cyan-400 animate-spin mx-auto mb-1.5" />
                                        <p className="text-xs font-semibold text-cyan-600 dark:text-cyan-400">Extracting criteria from PDF...</p>
                                        <p className="text-[10px] text-slate-500">Reading company, CGPA, arrears & depts</p>
                                    </div>
                                ) : (
                                    <>
                                        <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
                                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                            {jdFile ? jdFile.name : "Upload PDF or DOCX Job Description"}
                                        </p>
                                        <p className="text-[11px] text-cyan-600 dark:text-cyan-400 font-medium mt-0.5">
                                            {jdFile ? "Auto-extracted! Click to choose another" : "Auto-extracts criteria immediately on upload"}
                                        </p>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="mt-4">
                                <textarea
                                    value={jdText}
                                    onChange={(e) => setJdText(e.target.value)}
                                    placeholder="Paste full Job Description text here..."
                                    rows={3}
                                    className="w-full text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 resize-none font-mono"
                                />
                            </div>
                        )}

                        <div className="mt-3 flex items-center justify-between gap-2">
                            <button
                                onClick={() => handleParseJD()}
                                disabled={isParsingJD || (jdInputMode === "file" && !jdFile) || (jdInputMode === "text" && !jdText.trim())}
                                className="w-full py-1.5 px-3 rounded-xl bg-cyan-50 dark:bg-cyan-600/20 hover:bg-cyan-100 dark:hover:bg-cyan-600/30 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all disabled:opacity-50"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>{isParsingJD ? "Extracting..." : "Re-Extract JD Criteria"}</span>
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>Extracted:</span>
                        <span className={criteria.company_name ? "text-cyan-600 dark:text-cyan-400 font-medium" : "text-slate-400 dark:text-slate-500"}>
                            {criteria.company_name || "None"}
                        </span>
                    </div>
                </div>
            </div>

            {/* Step 2: Extracted Criteria Review & Execution Panel */}
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm dark:shadow-lg backdrop-blur-md">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div>
                        <div className="flex items-center space-x-2">
                            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Extracted JD Eligibility Criteria</h2>
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30">
                                Active Rules
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Auto-parsed from the JD. You can customize any field below before running the student evaluation.
                        </p>
                    </div>

                    <div className="flex items-center space-x-2.5">
                        <button
                            onClick={() => setIsCriteriaEditable(!isCriteriaEditable)}
                            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all"
                        >
                            <Sliders className="w-3.5 h-3.5 text-slate-400" />
                            <span>{isCriteriaEditable ? "Lock Fields" : "Edit Criteria"}</span>
                        </button>

                        <button
                            onClick={handleEvaluate}
                            disabled={isEvaluating}
                            className="flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isEvaluating ? "animate-spin" : ""}`} />
                            <span>{isEvaluating ? "Evaluating Students..." : "Run Eligibility Evaluation"}</span>
                        </button>
                    </div>
                </div>

                {/* Criteria Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mt-4">
                    {/* Company */}
                    <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
                        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Company Name</label>
                        {isCriteriaEditable ? (
                            <input
                                type="text"
                                value={criteria.company_name}
                                onChange={(e) => setCriteria({ ...criteria, company_name: e.target.value })}
                                className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-900 dark:text-white"
                            />
                        ) : (
                            <p className="text-xs font-bold text-slate-900 dark:text-white mt-1 truncate">{criteria.company_name || "Any Company"}</p>
                        )}
                    </div>

                    {/* Role */}
                    <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
                        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Role / Designation</label>
                        {isCriteriaEditable ? (
                            <input
                                type="text"
                                value={criteria.job_role}
                                onChange={(e) => setCriteria({ ...criteria, job_role: e.target.value })}
                                className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-900 dark:text-white"
                            />
                        ) : (
                            <p className="text-xs font-bold text-slate-900 dark:text-white mt-1 truncate">{criteria.job_role || "General"}</p>
                        )}
                    </div>

                    {/* Package */}
                    <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
                        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">CTC / Package</label>
                        {isCriteriaEditable ? (
                            <input
                                type="text"
                                value={criteria.salary_package}
                                onChange={(e) => setCriteria({ ...criteria, salary_package: e.target.value })}
                                className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-900 dark:text-white"
                            />
                        ) : (
                            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">{criteria.salary_package || "Not Specified"}</p>
                        )}
                    </div>

                    {/* Batch */}
                    <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
                        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Target Batch</label>
                        {isCriteriaEditable ? (
                            <input
                                type="text"
                                value={criteria.batch}
                                placeholder="e.g. 2023-2027"
                                onChange={(e) => setCriteria({ ...criteria, batch: e.target.value })}
                                className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-900 dark:text-white"
                            />
                        ) : (
                            <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-1">{criteria.batch || "All Batches"}</p>
                        )}
                    </div>

                    {/* Min CGPA */}
                    <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
                        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Min UG CGPA</label>
                        {isCriteriaEditable ? (
                            <input
                                type="number"
                                step="0.1"
                                value={criteria.min_cgpa}
                                onChange={(e) => setCriteria({ ...criteria, min_cgpa: parseFloat(e.target.value) || 0 })}
                                className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-900 dark:text-white"
                            />
                        ) : (
                            <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400 mt-1">
                                {criteria.min_cgpa > 0 ? `${criteria.min_cgpa.toFixed(2)} & Above` : "No Cutoff"}
                            </p>
                        )}
                    </div>

                    {/* Standing Arrears */}
                    <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80">
                        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Max Current Arrears</label>
                        {isCriteriaEditable ? (
                            <input
                                type="number"
                                value={criteria.max_current_arrears}
                                onChange={(e) => setCriteria({ ...criteria, max_current_arrears: parseInt(e.target.value) || 0 })}
                                className="w-full mt-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-900 dark:text-white"
                            />
                        ) : (
                            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-1">
                                {criteria.max_current_arrears === 0 ? "0 (Zero Standing)" : `Max ${criteria.max_current_arrears}`}
                            </p>
                        )}
                    </div>
                </div>

                {/* Second row of criteria badges: Departments, Certs, Allowing Status Rules */}
                <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium">Eligible Departments:</span>
                        {isCriteriaEditable ? (
                            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1.5 bg-slate-50 dark:bg-slate-950/80 rounded-lg border border-slate-200 dark:border-slate-800">
                                {ALL_COLLEGE_DEPARTMENTS.map((dept) => {
                                    const isSelected = criteria.eligible_departments.some(d => d.toUpperCase() === dept.toUpperCase());
                                    return (
                                        <button
                                            key={dept}
                                            type="button"
                                            onClick={() => {
                                                const exists = criteria.eligible_departments.some(d => d.toUpperCase() === dept.toUpperCase());
                                                const updated = exists
                                                    ? criteria.eligible_departments.filter(d => d.toUpperCase() !== dept.toUpperCase())
                                                    : [...criteria.eligible_departments, dept];
                                                setCriteria({ ...criteria, eligible_departments: updated });
                                            }}
                                            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                                isSelected
                                                    ? "bg-indigo-600 text-white border border-indigo-400"
                                                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700"
                                            }`}
                                        >
                                            {dept}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : criteria.eligible_departments.length > 0 ? (
                            criteria.eligible_departments.map((d) => (
                                <span key={d} className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/20 font-semibold text-[11px]">
                                    {d}
                                </span>
                            ))
                        ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">All Branches Open</span>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-slate-500 dark:text-slate-400 text-[11px] font-medium">Required Certifications:</span>
                        {criteria.required_certifications.length > 0 ? (
                            criteria.required_certifications.map((c) => (
                                <span key={c} className="px-2 py-0.5 rounded-md bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/20 font-semibold text-[11px]">
                                    {c}
                                </span>
                            ))
                        ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">None Required</span>
                        )}
                    </div>

                    <div className="flex items-center space-x-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-500/20 font-medium">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Allowing Status Filter: Placed students with "Allowed / Dream" status are permitted</span>
                    </div>
                </div>
            </div>

            {/* Step 3: Analytics KPI Cards */}
            {summary && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                    {/* Total Evaluated */}
                    <div
                        onClick={() => setActiveTab("ALL")}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                            activeTab === "ALL"
                                ? "bg-indigo-50 dark:bg-indigo-600/15 border-indigo-300 dark:border-indigo-500/50 shadow-md shadow-indigo-500/10"
                                : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm"
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Evaluated</span>
                            <GraduationCap className="w-4 h-4 text-slate-400" />
                        </div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">{summary.total_evaluated}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Students in Master sheet</p>
                    </div>

                    {/* Total Eligible */}
                    <div
                        onClick={() => setActiveTab("ELIGIBLE")}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                            activeTab === "ELIGIBLE"
                                ? "bg-emerald-50 dark:bg-emerald-600/15 border-emerald-300 dark:border-emerald-500/50 shadow-md shadow-emerald-500/10"
                                : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm"
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Total Eligible</span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1.5">{summary.total_eligible}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                            {summary.total_evaluated ? `${Math.round((summary.total_eligible / summary.total_evaluated) * 100)}% of candidates` : ""}
                        </p>
                    </div>

                    {/* Eligible Unplaced */}
                    <div
                        onClick={() => setActiveTab("UNPLACED_ELIGIBLE")}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                            activeTab === "UNPLACED_ELIGIBLE"
                                ? "bg-cyan-50 dark:bg-cyan-600/15 border-cyan-300 dark:border-cyan-500/50 shadow-md shadow-cyan-500/10"
                                : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm"
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400">Fresh / Unplaced</span>
                            <Sparkles className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                        </div>
                        <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 mt-1.5">{summary.eligible_unplaced}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Not placed in any firm</p>
                    </div>

                    {/* Placed & Allowed (Crucial Requirement) */}
                    <div
                        onClick={() => setActiveTab("PLACED_ALLOWED")}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                            activeTab === "PLACED_ALLOWED"
                                ? "bg-emerald-100/70 dark:bg-emerald-600/20 border-emerald-400 dark:border-emerald-400 shadow-md shadow-emerald-500/20"
                                : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-500/40 shadow-sm"
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">Placed - Allowed</span>
                            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1.5">{summary.placed_allowed}</p>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400/80 font-medium mt-0.5">Permitted to attend!</p>
                    </div>

                    {/* Placed - Not Allowed */}
                    <div
                        onClick={() => setActiveTab("PLACED_NOT_ALLOWED")}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                            activeTab === "PLACED_NOT_ALLOWED"
                                ? "bg-amber-50 dark:bg-amber-600/15 border-amber-300 dark:border-amber-500/50 shadow-md shadow-amber-500/10"
                                : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm"
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Placed - Blocked</span>
                            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1.5">{summary.placed_not_allowed}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">Status: Not Allowed</p>
                    </div>

                    {/* Ineligible (Criteria Mismatch) */}
                    <div
                        onClick={() => setActiveTab("INELIGIBLE")}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                            activeTab === "INELIGIBLE"
                                ? "bg-rose-50 dark:bg-rose-600/15 border-rose-300 dark:border-rose-500/50 shadow-md shadow-rose-500/10"
                                : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm"
                        }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">Criteria Mismatch</span>
                            <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        </div>
                        <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1.5">{summary.criteria_mismatch}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">CGPA / Arrears / Branch</p>
                    </div>
                </div>
            )}

            {/* Step 4: Candidates List & Interactive Filter Toolbar */}
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm dark:shadow-xl">
                {/* Tabs & Search Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                        {/* Tab Switcher */}
                        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-950/70 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                            <button
                                onClick={() => setActiveTab("ELIGIBLE")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    activeTab === "ELIGIBLE"
                                        ? "bg-emerald-600 text-white shadow"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                All Eligible ({summary?.total_eligible || 0})
                            </button>
                            <button
                                onClick={() => setActiveTab("PLACED_ALLOWED")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1 ${
                                    activeTab === "PLACED_ALLOWED"
                                        ? "bg-indigo-600 text-white shadow"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                <span>Placed & Allowed</span>
                                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white/20 text-[10px]">
                                    {summary?.placed_allowed || 0}
                                </span>
                            </button>
                            <button
                                onClick={() => setActiveTab("UNPLACED_ELIGIBLE")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    activeTab === "UNPLACED_ELIGIBLE"
                                        ? "bg-cyan-600 text-white shadow"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                Unplaced Fresh ({summary?.eligible_unplaced || 0})
                            </button>
                            <button
                                onClick={() => setActiveTab("PLACED_NOT_ALLOWED")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    activeTab === "PLACED_NOT_ALLOWED"
                                        ? "bg-amber-600 text-white shadow"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                Placed - Not Allowed ({summary?.placed_not_allowed || 0})
                            </button>
                            <button
                                onClick={() => setActiveTab("INELIGIBLE")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    activeTab === "INELIGIBLE"
                                        ? "bg-rose-600 text-white shadow"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                Ineligible ({summary?.criteria_mismatch || 0})
                            </button>
                            <button
                                onClick={() => setActiveTab("ALL")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    activeTab === "ALL" 
                                        ? "bg-slate-800 dark:bg-slate-700 text-white shadow" 
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                All ({summary?.total_evaluated || 0})
                            </button>
                        </div>

                        {/* Export Buttons */}
                        <div className="flex items-center space-x-2 shrink-0">
                            <button
                                onClick={handleExportExcel}
                                disabled={isExporting || filteredStudents.length === 0}
                                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span>{isExporting ? "Exporting..." : "Export Excel (.xlsx)"}</span>
                            </button>
                        </div>
                    </div>

                    {/* Filter Controls Toolbar */}
                    <div className="space-y-2.5 pt-1">
                        {/* Row 1: Search, Batch, Undertaking, Current Arrears, History of Arrears */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                            {/* Search Input */}
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search by Reg No, Name, Dept..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            {/* Batch Filter */}
                            <div>
                                <select
                                    value={selectedBatch}
                                    onChange={(e) => setSelectedBatch(e.target.value)}
                                    className="w-full text-xs px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="ALL">Batch: All Batches</option>
                                    {availableBatches.map((b) => (
                                        <option key={b} value={b}>Batch: {b}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Undertaking Filter (Type Input) */}
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Undertaking: Type to search..."
                                    value={selectedUndertaking}
                                    onChange={(e) => setSelectedUndertaking(e.target.value)}
                                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                                />
                                {selectedUndertaking && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedUndertaking("")}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>

                            {/* Current Arrear Count Filter (Integer field) */}
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    placeholder="Max Current Arrears (int)"
                                    value={selectedArrearCount}
                                    onChange={(e) => setSelectedArrearCount(e.target.value)}
                                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                                />
                                {selectedArrearCount !== "" && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedArrearCount("")}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>

                            {/* History of Arrear Filter (Integer field) */}
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    placeholder="Max History Arrears (int)"
                                    value={selectedHistoryArrear}
                                    onChange={(e) => setSelectedHistoryArrear(e.target.value)}
                                    className="w-full text-xs px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                                />
                                {selectedHistoryArrear !== "" && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedHistoryArrear("")}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Row 2: Certificate, Department, Gender, Allowing Status, SSG (Extra Filter), Reset Button */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
                            {/* Certificate Filter */}
                            <div>
                                <select
                                    value={selectedCertificate}
                                    onChange={(e) => setSelectedCertificate(e.target.value)}
                                    className="w-full text-xs px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="ALL">Certificate: All</option>
                                    <option value="ANY">Certificate: Any Completed</option>
                                    <option value="CISCO">Certificate: Cisco</option>
                                    <option value="AI_NAVIGATE">Certificate: AI - navigate</option>
                                    <option value="ORACLE">Certificate: Oracle</option>
                                    <option value="MAVEN_SILICON">Certificate: Maven Silicon VLSI</option>
                                    <option value="EMBEDDED">Certificate: Embedded</option>
                                    <option value="JAPANESE">Certificate: Japanese</option>
                                    <option value="SERVICENOW">Certificate: ServiceNow</option>
                                </select>
                            </div>

                            {/* Department Filter (All 21 Departments) */}
                            <div>
                                <select
                                    value={selectedDept}
                                    onChange={(e) => setSelectedDept(e.target.value)}
                                    className="w-full text-xs px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="ALL">Department: All ({availableDepts.length} Branches)</option>
                                    {availableDepts.map((d) => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Gender Filter */}
                            <div>
                                <select
                                    value={selectedGender}
                                    onChange={(e) => setSelectedGender(e.target.value)}
                                    className="w-full text-xs px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="ALL">Gender: All</option>
                                    <option value="MALE">Gender: Male</option>
                                    <option value="FEMALE">Gender: Female</option>
                                </select>
                            </div>

                            {/* Allowing Status Filter */}
                            <div>
                                <select
                                    value={selectedAllowingStatus}
                                    onChange={(e) => setSelectedAllowingStatus(e.target.value)}
                                    className="w-full text-xs px-2.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="ALL">Allowing Status: All</option>
                                    {availableAllowingStatuses.map((st) => (
                                        <option key={st} value={st}>Allowing: {st}</option>
                                    ))}
                                </select>
                            </div>

                            {/* SSG Student Filter (Extra Filter) */}
                            <div>
                                <select
                                    value={selectedSSGFilter}
                                    onChange={(e) => setSelectedSSGFilter(e.target.value as "ALL" | "SSG_ONLY" | "NON_SSG")}
                                    className={`w-full text-xs px-2.5 py-2 rounded-xl focus:outline-none transition-all ${
                                        selectedSSGFilter !== "ALL"
                                            ? "bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/60 text-amber-800 dark:text-amber-300 font-semibold shadow-sm"
                                            : "bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 focus:border-indigo-500"
                                    }`}
                                >
                                    <option value="ALL">SSG: All Students</option>
                                    <option value="SSG_ONLY">★ SSG Students Only</option>
                                    <option value="NON_SSG">Non-SSG Students</option>
                                </select>
                            </div>

                            {/* Reset Filters Button */}
                            <div>
                                <button
                                    onClick={handleResetFilters}
                                    disabled={activeFiltersCount === 0}
                                    className="w-full h-full py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Reset Filters</span>
                                    {activeFiltersCount > 0 && (
                                        <span className="ml-1 px-1.5 py-0.2 rounded-full bg-indigo-500 text-white text-[10px] font-bold">
                                            {activeFiltersCount}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Candidates Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 select-none">
                                <th className="py-3 px-3.5 w-12 text-center">#</th>
                                <th className="py-3 px-3.5">Register No</th>
                                <th className="py-3 px-3.5">Student Name</th>
                                <th className="py-3 px-3.5">Department</th>
                                <th className="py-3 px-3.5 text-center">Batch</th>
                                <th className="py-3 px-3.5 text-center">CGPA</th>
                                <th className="py-3 px-3.5 text-center">Arrears</th>
                                <th className="py-3 px-3.5">Placement / Allowing Status</th>
                                <th className="py-3 px-3.5">Eligibility Outcome</th>
                                <th className="py-3 px-3.5 text-center">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-sans">
                            {filteredStudents.length > 0 ? (
                                filteredStudents.map((stu, idx) => (
                                    <tr
                                        key={stu.reg_no}
                                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                                            stu.status_code === "PLACED_ALLOWED"
                                                ? "bg-emerald-50/50 dark:bg-emerald-950/10"
                                                : stu.status_code === "PLACED_NOT_ALLOWED"
                                                ? "bg-amber-50/50 dark:bg-amber-950/10"
                                                : stu.is_eligible
                                                ? ""
                                                : "opacity-80"
                                        }`}
                                    >
                                        <td className="py-3 px-3.5 text-center text-slate-400 dark:text-slate-500 font-mono text-[11px]">{idx + 1}</td>
                                        <td className="py-3 px-3.5 font-mono font-semibold text-slate-900 dark:text-white">{stu.reg_no}</td>
                                        <td className="py-3 px-3.5">
                                            <div className="flex items-center space-x-1.5">
                                                <span className="font-medium text-slate-800 dark:text-slate-200">{stu.student_name}</span>
                                                {stu.is_ssg && (
                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40 shrink-0">
                                                        ★ SSG
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-slate-500 dark:text-slate-400">{stu.official_email}</div>
                                        </td>
                                        <td className="py-3 px-3.5">
                                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 text-[11px] font-medium">
                                                {stu.dept_code || stu.department}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3.5 text-center text-slate-700 dark:text-slate-300 text-[11px]">{stu.batch}</td>
                                        <td className="py-3 px-3.5 text-center font-semibold font-mono text-cyan-600 dark:text-cyan-400">
                                            {stu.ug_cgpa ? stu.ug_cgpa.toFixed(2) : "N/A"}
                                        </td>
                                        <td className="py-3 px-3.5 text-center">
                                            <span
                                                className={`px-2 py-0.5 rounded font-mono text-[11px] font-medium ${
                                                    stu.arrear_count === 0
                                                        ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20"
                                                        : "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20"
                                                }`}
                                            >
                                                {stu.arrear_count} (Hist: {stu.history_arrear})
                                            </span>
                                        </td>

                                        {/* Placed & Allowing Status Cell */}
                                        <td className="py-3 px-3.5">
                                            {stu.is_placed ? (
                                                <div className="space-y-1">
                                                    <div className="flex items-center space-x-1.5 text-slate-800 dark:text-slate-200 font-medium">
                                                        <Building2 className="w-3 h-3 text-purple-600 dark:text-purple-400 shrink-0" />
                                                        <span className="truncate max-w-[150px]">{stu.placed_company || "Placed"}</span>
                                                        {stu.salary_package > 0 && (
                                                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400">({stu.salary_package}L)</span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <span
                                                            className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                                                stu.status_code === "PLACED_ALLOWED"
                                                                    ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30"
                                                                    : "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30"
                                                            }`}
                                                        >
                                                            {stu.status_code === "PLACED_ALLOWED" ? (
                                                                <ShieldCheck className="w-2.5 h-2.5" />
                                                            ) : (
                                                                <ShieldAlert className="w-2.5 h-2.5" />
                                                            )}
                                                            <span>Status: {stu.allowing_status || "Not Allowed"}</span>
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 dark:text-slate-500 text-[11px] italic">Unplaced</span>
                                            )}
                                        </td>

                                        {/* Eligibility Outcome */}
                                        <td className="py-3 px-3.5">
                                            {stu.status_code === "ELIGIBLE_UNPLACED" && (
                                                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30">
                                                    <CheckCircle2 className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                                                    <span>Eligible (Unplaced)</span>
                                                </span>
                                            )}
                                            {stu.status_code === "PLACED_ALLOWED" && (
                                                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                                                    <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                                    <span>Placed - Allowed to Attend</span>
                                                </span>
                                            )}
                                            {stu.status_code === "PLACED_NOT_ALLOWED" && (
                                                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30">
                                                    <ShieldAlert className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                                    <span>Placed - Not Allowed</span>
                                                </span>
                                            )}
                                            {stu.status_code === "CRITERIA_MISMATCH" && (
                                                <div className="space-y-0.5">
                                                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30">
                                                        <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                                        <span>Ineligible</span>
                                                    </span>
                                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 max-w-xs truncate" title={stu.reason}>
                                                        {stu.reason}
                                                    </div>
                                                </div>
                                            )}
                                        </td>

                                        {/* Action: View full profile */}
                                        <td className="py-3 px-3.5 text-center">
                                            <button
                                                onClick={() => setSelectedStudent(stu)}
                                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all"
                                                title="View full student details & certifications"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={10} className="py-12 text-center text-slate-500 dark:text-slate-400">
                                        <AlertCircle className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-600 mb-2" />
                                        <p className="text-sm font-medium">No students match current filter criteria.</p>
                                        <p className="text-xs text-slate-400 dark:text-slate-600 mt-0.5">Try resetting filters or changing the active tab.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Table Footer info */}
                <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
                    <span>
                        Showing <strong className="text-slate-900 dark:text-white">{filteredStudents.length}</strong> of{" "}
                        <strong className="text-slate-900 dark:text-white">{students.length}</strong> total evaluated candidates
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        {summary?.company_name ? `Drive: ${summary.company_name}` : "Admin Placement Cell"}
                    </span>
                </div>
            </div>

            {/* Student Detail Modal Drawer */}
            {selectedStudent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6">
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                            <div>
                                <div className="flex items-center space-x-2">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedStudent.student_name}</h3>
                                    {selectedStudent.is_ssg && (
                                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40">
                                            ★ SSG Student
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{selectedStudent.reg_no} • {selectedStudent.department}</p>
                            </div>
                            <button
                                onClick={() => setSelectedStudent(null)}
                                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Status banner */}
                        <div
                            className={`mt-4 p-3.5 rounded-xl border flex items-center space-x-3 text-xs font-medium ${
                                selectedStudent.status_code === "PLACED_ALLOWED"
                                    ? "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                                    : selectedStudent.status_code === "ELIGIBLE_UNPLACED"
                                    ? "bg-cyan-50 dark:bg-cyan-500/15 border-cyan-200 dark:border-cyan-500/30 text-cyan-800 dark:text-cyan-300"
                                    : selectedStudent.status_code === "PLACED_NOT_ALLOWED"
                                    ? "bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300"
                                    : "bg-rose-50 dark:bg-rose-500/15 border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300"
                            }`}
                        >
                            {selectedStudent.is_eligible ? (
                                <ShieldCheck className="w-5 h-5 shrink-0" />
                            ) : (
                                <ShieldAlert className="w-5 h-5 shrink-0" />
                            )}
                            <div>
                                <p className="font-bold">{selectedStudent.status_label}</p>
                                <p className="text-[11px] opacity-90 mt-0.5">{selectedStudent.reason}</p>
                            </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 mt-5 text-xs">
                            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80">
                                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">UG CGPA</span>
                                <span className="text-cyan-600 dark:text-cyan-400 font-bold text-sm mt-0.5 block">{selectedStudent.ug_cgpa}</span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80">
                                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">Current Arrears</span>
                                <span className="text-slate-900 dark:text-white font-bold text-sm mt-0.5 block">{selectedStudent.arrear_count}</span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80">
                                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">History of Arrears</span>
                                <span className="text-slate-900 dark:text-white font-bold text-sm mt-0.5 block">{selectedStudent.history_arrear}</span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80">
                                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">12th Percentage</span>
                                <span className="text-slate-900 dark:text-white font-semibold mt-0.5 block">{selectedStudent.twelfth_percent ? `${selectedStudent.twelfth_percent}%` : "N/A"}</span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80">
                                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">Diploma Percentage</span>
                                <span className="text-slate-900 dark:text-white font-semibold mt-0.5 block">{selectedStudent.diploma_percent ? `${selectedStudent.diploma_percent}%` : "N/A"}</span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80">
                                <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">Batch & Gender</span>
                                <span className="text-slate-900 dark:text-white font-semibold mt-0.5 block">{selectedStudent.batch} • {selectedStudent.gender}</span>
                            </div>
                        </div>

                        {/* Placement details if placed */}
                        {selectedStudent.is_placed && (
                            <div className="mt-5 p-4 rounded-xl bg-purple-50/60 dark:bg-slate-950 border border-purple-200 dark:border-purple-500/20">
                                <h4 className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                                    <Building2 className="w-3.5 h-3.5" />
                                    <span>Placement Offer Record</span>
                                </h4>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">Placed Company:</span>
                                        <p className="font-semibold text-slate-900 dark:text-white mt-0.5">{selectedStudent.placed_company}</p>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">Salary Package (LPA):</span>
                                        <p className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">{selectedStudent.salary_package} LPA</p>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-slate-500 dark:text-slate-400 text-[11px]">Allowing Status:</span>
                                        <p className="font-semibold text-indigo-600 dark:text-indigo-300 mt-0.5">{selectedStudent.allowing_status || "Not Specified"}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Certifications Checklist */}
                        <div className="mt-5">
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider mb-2">Track Certifications</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                {[
                                    { label: "Cisco", val: selectedStudent.cisco },
                                    { label: "AI - navigate", val: selectedStudent.ai_navigate },
                                    { label: "Oracle", val: selectedStudent.oracle },
                                    { label: "Maven Silicon VLSI", val: selectedStudent.maven_silicon },
                                    { label: "Embedded", val: selectedStudent.embedded },
                                    { label: "Japanese", val: selectedStudent.japanese },
                                    { label: "ServiceNow", val: selectedStudent.servicenow },
                                    { label: "Any Certification", val: selectedStudent.any_one_cert },
                                ].map((cert) => {
                                    const hasIt = cert.val?.toLowerCase().includes("yes") || Boolean(cert.val && cert.val !== "No" && cert.val !== "0");
                                    return (
                                        <div
                                            key={cert.label}
                                            className={`p-2 rounded-lg border text-center ${
                                                hasIt
                                                    ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                                    : "bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500"
                                            }`}
                                        >
                                            <span className="block font-medium text-[11px] truncate">{cert.label}</span>
                                            <span className="text-[10px] font-bold block mt-0.5">{hasIt ? "Completed" : "Not Done"}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Contacts & Info */}
                        <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-3 text-xs text-slate-700 dark:text-slate-300">
                            <div>
                                <span className="text-slate-500 dark:text-slate-400 text-[10px] block">Official Email:</span>
                                <span className="font-mono">{selectedStudent.official_email || "N/A"}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 dark:text-slate-400 text-[10px] block">Personal Email:</span>
                                <span className="font-mono">{selectedStudent.personal_email || "N/A"}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 dark:text-slate-400 text-[10px] block">Mobile:</span>
                                <span className="font-mono">{selectedStudent.mobile || "N/A"}</span>
                            </div>
                            <div>
                                <span className="text-slate-500 dark:text-slate-400 text-[10px] block">Residence & Undertaking:</span>
                                <span>{selectedStudent.hosteller_dayscholar || "N/A"} • Undertaking: {selectedStudent.undertaking || "N/A"}</span>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={() => setSelectedStudent(null)}
                                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
                            >
                                Close Details
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default JDMatchingPage;
