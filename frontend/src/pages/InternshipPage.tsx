import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { EmptyState } from "../components/EmptyState";
import { Briefcase, SlidersHorizontal } from "lucide-react";

interface InternshipRecord {
    s_no: number | null;
    register_number: string;
    full_name: string;
    department: string;
    company_name: string;
    ctc_lpa: number | null;
    ctc_display: string;
    internship_status: string;
    internship_mode: string;
    company_type: string;
    organized_by: string;
    allowing_status: string;
    email: string;
    contact: string;
}

interface FilterOptions {
    internship_statuses: string[];
    internship_modes: string[];
    company_types: string[];
    organized_by: string[];
}

const ALL = "ALL";
const EMPTY_MODE = "__EMPTY__";

const InternshipPage: React.FC = () => {
    const [allItems, setAllItems] = useState<InternshipRecord[]>([]);
    const [filterOptions, setFilterOptions] = useState<FilterOptions>({
        internship_statuses: [],
        internship_modes: [],
        company_types: [],
        organized_by: [],
    });
    const [sourceFile, setSourceFile] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [internshipStatus, setInternshipStatus] = useState(ALL);
    const [internshipMode, setInternshipMode] = useState(ALL);
    const [companyType, setCompanyType] = useState(ALL);
    const [organizedBy, setOrganizedBy] = useState(ALL);
    const [companySearch, setCompanySearch] = useState("");
    const [ctcSearch, setCtcSearch] = useState("");

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await api.get("/admin/internships");
            setAllItems(res.data.items ?? []);
            setFilterOptions(
                res.data.filter_options ?? {
                    internship_statuses: [],
                    internship_modes: [],
                    company_types: [],
                    organized_by: [],
                }
            );
            setSourceFile(res.data.source_file ?? "");
        } catch (err: unknown) {
            console.error(err);
            setError("Could not load internship data from the offer Excel file.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredItems = useMemo(() => {
        return allItems.filter((row) => {
            if (internshipStatus !== ALL && row.internship_status !== internshipStatus) return false;
            if (internshipMode === EMPTY_MODE) {
                if (row.internship_mode) return false;
            } else if (internshipMode !== ALL && row.internship_mode.toLowerCase() !== internshipMode.toLowerCase()) {
                return false;
            }
            if (companyType !== ALL && row.company_type.toUpperCase() !== companyType.toUpperCase()) return false;
            if (organizedBy !== ALL && row.organized_by !== organizedBy) return false;
            if (companySearch.trim()) {
                const term = companySearch.trim().toLowerCase();
                if (!row.company_name.toLowerCase().includes(term)) return false;
            }
            if (ctcSearch.trim()) {
                const q = ctcSearch.trim();
                const display = row.ctc_display || "";
                if (display.toLowerCase().includes(q.toLowerCase())) return true;
                const qNum = parseFloat(q);
                if (!Number.isNaN(qNum) && row.ctc_lpa != null) {
                    if (Math.abs(row.ctc_lpa - qNum) < 1e-9) return true;
                    const asStr = String(row.ctc_lpa);
                    if (asStr.startsWith(q)) return true;
                }
                return false;
            }
            return true;
        });
    }, [allItems, internshipStatus, internshipMode, companyType, organizedBy, companySearch, ctcSearch]);

    const clearFilters = () => {
        setInternshipStatus(ALL);
        setInternshipMode(ALL);
        setCompanyType(ALL);
        setOrganizedBy(ALL);
        setCompanySearch("");
        setCtcSearch("");
    };

    const hasActiveFilters =
        internshipStatus !== ALL ||
        internshipMode !== ALL ||
        companyType !== ALL ||
        organizedBy !== ALL ||
        companySearch.trim() !== "" ||
        ctcSearch.trim() !== "";

    const selectClass =
        "w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm outline-none focus:border-indigo-500";

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Briefcase className="w-7 h-7 text-indigo-500" />
                    Internship
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                    {filteredItems.length} of {allItems.length} students
                    {sourceFile ? ` · Source: ${sourceFile}` : ""}
                </p>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                        <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
                        Filters
                    </div>
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                            Clear all
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                    <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                            Internship status
                        </label>
                        <select
                            value={internshipStatus}
                            onChange={(e) => setInternshipStatus(e.target.value)}
                            className={selectClass}
                        >
                            <option value={ALL}>All</option>
                            {filterOptions.internship_statuses.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                            Internship mode
                        </label>
                        <select
                            value={internshipMode}
                            onChange={(e) => setInternshipMode(e.target.value)}
                            className={selectClass}
                        >
                            <option value={ALL}>All</option>
                            {filterOptions.internship_modes.map((m) => (
                                <option key={m} value={m}>
                                    {m}
                                </option>
                            ))}
                            <option value={EMPTY_MODE}>(Empty / not set)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                            Company type
                        </label>
                        <select
                            value={companyType}
                            onChange={(e) => setCompanyType(e.target.value)}
                            className={selectClass}
                        >
                            <option value={ALL}>All</option>
                            {filterOptions.company_types.map((t) => (
                                <option key={t} value={t}>
                                    {t}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                            Organised by
                        </label>
                        <select
                            value={organizedBy}
                            onChange={(e) => setOrganizedBy(e.target.value)}
                            className={selectClass}
                        >
                            <option value={ALL}>All</option>
                            {filterOptions.organized_by.map((o) => (
                                <option key={o} value={o}>
                                    {o}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                            Search company
                        </label>
                        <input
                            type="text"
                            value={companySearch}
                            onChange={(e) => setCompanySearch(e.target.value)}
                            placeholder="Type company name…"
                            className={selectClass}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                            Search CTC (LPA)
                        </label>
                        <input
                            type="text"
                            value={ctcSearch}
                            onChange={(e) => setCtcSearch(e.target.value)}
                            placeholder="e.g. 5 or 4.5"
                            className={selectClass}
                        />
                    </div>
                </div>
            </div>

            {isLoading ? (
                <LoadingSpinner />
            ) : error ? (
                <EmptyState title="Load failed" description={error} icon={<Briefcase className="w-8 h-8 text-indigo-400" />} />
            ) : filteredItems.length === 0 ? (
                <EmptyState
                    title="No students match"
                    description="Adjust your filters or search terms."
                    icon={<Briefcase className="w-8 h-8 text-indigo-400" />}
                />
            ) : (
                <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/80 text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    <th className="px-4 py-3 font-semibold">Student name</th>
                                    <th className="px-4 py-3 font-semibold">Register no.</th>
                                    <th className="px-4 py-3 font-semibold">Department</th>
                                    <th className="px-4 py-3 font-semibold">Company</th>
                                    <th className="px-4 py-3 font-semibold">CTC (LPA)</th>
                                    <th className="px-4 py-3 font-semibold">Status</th>
                                    <th className="px-4 py-3 font-semibold">Mode</th>
                                    <th className="px-4 py-3 font-semibold">Type</th>
                                    <th className="px-4 py-3 font-semibold">Organised by</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {filteredItems.map((row) => (
                                    <tr
                                        key={`${row.register_number}-${row.s_no ?? row.full_name}`}
                                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                                    >
                                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white whitespace-nowrap">
                                            {row.full_name || "—"}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                            {row.register_number || "—"}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-[200px] truncate" title={row.department}>
                                            {row.department || "—"}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-[180px] truncate" title={row.company_name}>
                                            {row.company_name || "—"}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                            {row.ctc_display || "—"}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">{row.internship_status || "—"}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{row.internship_mode || "—"}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{row.company_type || "—"}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{row.organized_by || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InternshipPage;
