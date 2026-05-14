"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
    BadgeCheck,
    Building2,
    Eye,
    EyeOff,
    Loader2,
    Lock,
    Mail,
    MapPin,
    Phone,
    User,
} from "lucide-react";

import { decodeJwt, login, registerUser, saveTokens, type Gender } from "@/api/auth";
import { registerEmployee } from "@/api/employees";
import {
    getDepartments,
    getWorkingLocations,
    type Department,
    type WorkingLocation,
} from "@/api/working_locations";

type AccountType = "USER" | "EMPLOYEE";

const emptyForm = {
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    password: "",
    gender: "MALE" as Gender,
    national_id: "",
    hire_date: "",
    department_id: "",
    working_location_id: "",
};

export default function LoginPage() {
    const router = useRouter();
    const [isLogin, setIsLogin] = useState(true);
    const [accountType, setAccountType] = useState<AccountType>("USER");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [message, setMessage] = useState("");
    const [form, setForm] = useState(emptyForm);
    const [workingLocations, setWorkingLocations] = useState<WorkingLocation[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);

    const title = isLogin ? "Login" : "Create account";
    const helpText = useMemo(() => {
        if (isLogin) return "Use your email or phone number with your password.";
        if (accountType === "USER") return "User accounts wait for admin approval before access.";
        return "Employee accounts are sent to admin or branch manager for approval.";
    }, [accountType, isLogin]);

    useEffect(() => {
        const remembered = localStorage.getItem("remember_identifier");

        if (remembered) {
            setForm((current) => ({ ...current, email: remembered }));
            setRememberMe(true);
        }
    }, []);

    useEffect(() => {
        const loadLocations = async () => {
            try {
                setWorkingLocations(await getWorkingLocations());
            } catch (error) {
                console.error("Failed to load working locations", error);
            }
        };

        loadLocations();
    }, []);

    useEffect(() => {
        const loadDepartments = async () => {
            if (!form.working_location_id) {
                setDepartments([]);
                updateField("department_id", "");
                return;
            }

            try {
                const data = await getDepartments(form.working_location_id);
                setDepartments(data);
                if (!data.some((department) => department.id === form.department_id)) {
                    updateField("department_id", "");
                }
            } catch (error) {
                console.error("Failed to load departments", error);
            }
        };

        loadDepartments();
    }, [form.working_location_id]);

    const updateField = (field: keyof typeof emptyForm, value: string) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const showError = (value: string) => {
        setMessage(value);
        setTimeout(() => setMessage(""), 5000);
    };

    const getErrorMessage = (error: unknown) => {
        if (axios.isAxiosError(error)) {
            const responseMessage = error.response?.data?.message;
            return Array.isArray(responseMessage)
                ? responseMessage.join(", ")
                : responseMessage || error.message;
        }

        return "Something went wrong. Please try again.";
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setLoading(true);
        setMessage("");

        try {
            if (isLogin) {
                if (!form.email || !form.password) {
                    showError("Enter your email or phone number and password.");
                    return;
                }

                const tokens = await login({
                    identifier: form.email,
                    password: form.password,
                });

                saveTokens(tokens);

                if (rememberMe) {
                    localStorage.setItem("remember_identifier", form.email);
                } else {
                    localStorage.removeItem("remember_identifier");
                }

                const user = decodeJwt(tokens.access_token);
                const isBranchManager = user?.roles.includes("BRANCH_MANAGER");

                localStorage.setItem("lastLoginRole", isBranchManager ? "branch-manager" : "admin");
                router.push(isBranchManager ? "/branch-manager" : "/admin");
                return;
            }

            if (!form.first_name || !form.last_name || !form.gender) {
                showError("First name, last name, and gender are required.");
                return;
            }

            if (accountType === "USER") {
                if (!form.email || !form.phone_number || !form.password) {
                    showError("Users need email, phone number, and password.");
                    return;
                }

                await registerUser({
                    first_name: form.first_name,
                    last_name: form.last_name,
                    email: form.email,
                    phone_number: form.phone_number,
                    password: form.password,
                    gender: form.gender,
                    department_id: form.department_id || undefined,
                    working_location_id: form.working_location_id || undefined,
                });
            } else {
                if (!form.email || !form.phone_number || !form.password) {
                    showError("Employees need email, phone number, and password.");
                    return;
                }

                await registerEmployee({
                    first_name: form.first_name,
                    last_name: form.last_name,
                    email: form.email,
                    phone_number: form.phone_number,
                    password: form.password,
                    national_id: form.national_id || undefined,
                    gender: form.gender,
                    hire_date: form.hire_date || undefined,
                    department_id: form.department_id || undefined,
                    working_location_id: form.working_location_id || undefined,
                });
            }

            setForm(emptyForm);
            setIsLogin(true);
            showError("Registration submitted for admin or branch manager approval.");
        } catch (error) {
            showError(getErrorMessage(error));
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 text-slate-950">
            <div className="login-wave-bg" />

            <section className="relative z-10 w-full max-w-md rounded-lg border border-white/12 bg-white/95 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur">
                <div className="mb-6">
                    <p className="text-sm font-semibold text-red-600">REG Payment System</p>
                    <h1 className="mt-2 text-2xl font-bold">{title}</h1>
                    <p className="mt-2 text-sm text-slate-600">{helpText}</p>
                </div>

                <div className="mb-5 grid grid-cols-2 rounded-md bg-slate-100 p-1">
                    <button
                        type="button"
                        onClick={() => setIsLogin(true)}
                        className={`rounded px-3 py-2 text-sm font-medium ${isLogin ? "bg-white shadow-sm" : "text-slate-600"}`}
                    >
                        Login
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsLogin(false)}
                        className={`rounded px-3 py-2 text-sm font-medium ${!isLogin ? "bg-white shadow-sm" : "text-slate-600"}`}
                    >
                        Register
                    </button>
                </div>

                {message && (
                    <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {message}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                        <>
                            <SelectField
                                label="Account type"
                                value={accountType}
                                onChange={(value) => setAccountType(value as AccountType)}
                                options={[
                                    { value: "USER", label: "User login account" },
                                    { value: "EMPLOYEE", label: "Employee account" },
                                ]}
                            />

                            <InputField
                                icon={<User size={17} />}
                                label="First name"
                                value={form.first_name}
                                onChange={(value) => updateField("first_name", value)}
                                required
                            />
                            <InputField
                                icon={<User size={17} />}
                                label="Last name"
                                value={form.last_name}
                                onChange={(value) => updateField("last_name", value)}
                                required
                            />

                            <SelectField
                                label="Gender"
                                value={form.gender}
                                onChange={(value) => updateField("gender", value)}
                                options={[
                                    { value: "MALE", label: "Male" },
                                    { value: "FEMALE", label: "Female" },
                                ]}
                            />
                        </>
                    )}

                    <InputField
                        icon={<Mail size={17} />}
                        label={isLogin ? "Email or phone number" : "Email"}
                        value={form.email}
                        onChange={(value) => updateField("email", value)}
                        required={isLogin || accountType === "USER" || accountType === "EMPLOYEE"}
                    />

                    {!isLogin && (
                        <>
                            <InputField
                                icon={<Phone size={17} />}
                                label="Phone number"
                                value={form.phone_number}
                                onChange={(value) => updateField("phone_number", value)}
                                required
                                placeholder="+250..."
                            />

                            {accountType === "EMPLOYEE" && (
                                <>
                                    <InputField
                                        icon={<BadgeCheck size={17} />}
                                        label="National ID"
                                        value={form.national_id}
                                        onChange={(value) => updateField("national_id", value)}
                                    />
                                    <InputField
                                        icon={<Building2 size={17} />}
                                        label="Hire date"
                                        type="date"
                                        value={form.hire_date}
                                        onChange={(value) => updateField("hire_date", value)}
                                    />
                                </>
                            )}

                            <SelectField
                                label="Working location"
                                value={form.working_location_id}
                                onChange={(value) => updateField("working_location_id", value)}
                                options={workingLocations.map((location) => ({
                                    value: location.id,
                                    label: `${location.name} (${location.type})`,
                                }))}
                                placeholder="Select working location"
                                icon={<MapPin size={17} />}
                            />

                            <SelectField
                                label="Department"
                                value={form.department_id}
                                onChange={(value) => updateField("department_id", value)}
                                options={departments.map((department) => ({
                                    value: department.id,
                                    label: department.name,
                                }))}
                                placeholder={form.working_location_id ? "Select department" : "Choose location first"}
                                icon={<Building2 size={17} />}
                                disabled={!form.working_location_id}
                            />
                        </>
                    )}

                    {(isLogin || accountType === "USER" || accountType === "EMPLOYEE") && (
                        <PasswordField
                            value={form.password}
                            showPassword={showPassword}
                            onChange={(value) => updateField("password", value)}
                            onToggle={() => setShowPassword((value) => !value)}
                        />
                    )}

                    {isLogin && (
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(event) => setRememberMe(event.target.checked)}
                                className="accent-red-600"
                            />
                            Remember me
                        </label>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-70"
                    >
                        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isLogin ? "Sign in" : "Submit registration"}
                    </button>
                </form>
            </section>
        </main>
    );
}

interface InputFieldProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    required?: boolean;
    type?: string;
}

function InputField({
    icon,
    label,
    value,
    onChange,
    placeholder,
    required = false,
    type = "text",
}: InputFieldProps) {
    return (
        <div>
            <label className="mb-2 block text-sm font-medium">
                {label}
                {required && <span className="text-red-600"> *</span>}
            </label>
            <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {icon}
                </div>
                <input
                    type={type}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder}
                    required={required}
                    className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-red-500"
                />
            </div>
        </div>
    );
}

function PasswordField({
    value,
    showPassword,
    onChange,
    onToggle,
}: {
    value: string;
    showPassword: boolean;
    onChange: (value: string) => void;
    onToggle: () => void;
}) {
    return (
        <div>
            <label className="mb-2 block text-sm font-medium">
                Password <span className="text-red-600">*</span>
            </label>
            <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                    type={showPassword ? "text" : "password"}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-10 text-sm outline-none focus:border-red-500"
                    required
                />
                <button
                    type="button"
                    onClick={onToggle}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
            </div>
        </div>
    );
}

function SelectField({
    label,
    value,
    onChange,
    options,
    placeholder,
    icon,
    disabled = false,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
    placeholder?: string;
    icon?: React.ReactNode;
    disabled?: boolean;
}) {
    return (
        <div>
            <label className="mb-2 block text-sm font-medium">{label}</label>
            <div className="relative">
                {icon && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        {icon}
                    </div>
                )}
                <select
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    disabled={disabled}
                    className={`h-11 w-full rounded-md border border-slate-300 bg-white text-sm outline-none focus:border-red-500 disabled:bg-slate-100 ${
                        icon ? "pl-10 pr-3" : "px-3"
                    }`}
                >
                    {placeholder && <option value="">{placeholder}</option>}
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
