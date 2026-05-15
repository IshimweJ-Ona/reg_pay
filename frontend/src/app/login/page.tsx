"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Building2, Eye, EyeOff, Loader2, Lock, Mail, MapPin, Phone, User } from "lucide-react";

import { login, registerUser, saveTokens, type Gender } from "@/api/auth";
import {
    getDepartments,
    getWorkingLocations,
    type Department,
    type WorkingLocation,
} from "@/api/working_locations";

const emptyForm = {
    identifier: "",
    password: "",
};

const emptyRegisterForm = {
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    gender: "MALE" as Gender,
    password: "",
    working_location_id: "",
    department_id: "",
};

export default function LoginPage() {
    const router = useRouter();
    const [mode, setMode] = useState<"login" | "register">("login");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [message, setMessage] = useState("");
    const [form, setForm] = useState(emptyForm);
    const [registerForm, setRegisterForm] = useState(emptyRegisterForm);
    const [workingLocations, setWorkingLocations] = useState<WorkingLocation[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [organizationLoading, setOrganizationLoading] = useState(false);

    useEffect(() => {
        const remembered = localStorage.getItem("remember_identifier");

        if (remembered) {
            setForm((current) => ({ ...current, identifier: remembered }));
            setRememberMe(true);
        }
    }, []);

    useEffect(() => {
        getWorkingLocations()
            .then(setWorkingLocations)
            .catch(() => setWorkingLocations([]));
    }, []);

    useEffect(() => {
        if (!registerForm.working_location_id) {
            setDepartments([]);
            return;
        }

        setOrganizationLoading(true);
        getDepartments(registerForm.working_location_id)
            .then(setDepartments)
            .catch(() => setDepartments([]))
            .finally(() => setOrganizationLoading(false));
    }, [registerForm.working_location_id]);

    const updateField = (field: keyof typeof emptyForm, value: string) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const updateRegisterField = (
        field: keyof typeof emptyRegisterForm,
        value: string,
    ) => {
        setRegisterForm((current) => ({
            ...current,
            [field]: value,
            ...(field === "working_location_id" ? { department_id: "" } : {}),
        }));
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
            if (!form.identifier || !form.password) {
                setMessage("Enter your email or phone number and password.");
                return;
            }

            const tokens = await login({
                identifier: form.identifier,
                password: form.password,
            });

            saveTokens(tokens);

            if (rememberMe) {
                localStorage.setItem("remember_identifier", form.identifier);
            } else {
                localStorage.removeItem("remember_identifier");
            }

            router.push("/users");
        } catch (error) {
            setMessage(getErrorMessage(error));
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setLoading(true);
        setMessage("");

        try {
            await registerUser(registerForm);
            const tokens = await login({
                identifier: registerForm.email,
                password: registerForm.password,
            });
            saveTokens(tokens);
            router.push("/users");
        } catch (error) {
            setMessage(getErrorMessage(error));
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 text-[#071426]">
            <div className="login-wave-bg" />

            <section className="relative z-10 w-full max-w-md rounded-lg border border-white/12 bg-white/95 p-6 text-[#071426] shadow-2xl shadow-slate-950/40 backdrop-blur">
                <div className="mb-6">
                    <p className="text-sm font-semibold text-[#071426]">REG Payment System</p>
                    <h1 className="mt-2 text-2xl font-bold">
                        {mode === "login" ? "Login" : "Register"}
                    </h1>
                    <p className="mt-2 text-sm text-[#0b2341]">
                        {mode === "login"
                            ? "Use your system account to continue."
                            : "Create your user account. Permissions are granted after admin review."}
                    </p>
                </div>

                <div className="mb-5 grid grid-cols-2 rounded-md bg-red-600 p-1 text-sm font-semibold text-white">
                    <button
                        type="button"
                        onClick={() => {
                            setMode("login");
                            setMessage("");
                        }}
                        className={`h-10 rounded ${mode === "login" ? "bg-white text-red-700" : "text-white"}`}
                    >
                        Login
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setMode("register");
                            setMessage("");
                        }}
                        className={`h-10 rounded ${mode === "register" ? "bg-white text-red-700" : "text-white"}`}
                    >
                        Register
                    </button>
                </div>

                {message && (
                    <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {message}
                    </div>
                )}

                {mode === "login" ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <InputField
                            icon={<Mail size={17} />}
                            label="Email or phone number"
                            placeholder="Enter email or phone number"
                            value={form.identifier}
                            onChange={(value) => updateField("identifier", value)}
                            required
                        />

                        <PasswordField
                            value={form.password}
                            showPassword={showPassword}
                            onChange={(value) => updateField("password", value)}
                            onToggle={() => setShowPassword((value) => !value)}
                        />

                        <label className="flex items-center gap-2 text-sm text-slate-600">
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(event) => setRememberMe(event.target.checked)}
                                className="accent-red-600"
                            />
                            Remember me
                        </label>

                        <SubmitButton loading={loading} label="Sign in" />
                    </form>
                ) : (
                    <form onSubmit={handleRegister} className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <InputField
                                icon={<User size={17} />}
                                label="First name"
                                placeholder="Enter first name"
                                value={registerForm.first_name}
                                onChange={(value) => updateRegisterField("first_name", value)}
                                required
                            />
                            <InputField
                                icon={<User size={17} />}
                                label="Last name"
                                placeholder="Enter last name"
                                value={registerForm.last_name}
                                onChange={(value) => updateRegisterField("last_name", value)}
                                required
                            />
                        </div>
                        <InputField
                            icon={<Mail size={17} />}
                            label="Email"
                            type="email"
                            placeholder="Enter email address"
                            value={registerForm.email}
                            onChange={(value) => updateRegisterField("email", value)}
                            required
                        />
                        <InputField
                            icon={<Phone size={17} />}
                            label="Phone number"
                            placeholder="Enter phone number"
                            value={registerForm.phone_number}
                            onChange={(value) => updateRegisterField("phone_number", value)}
                            required
                        />
                        <SelectField
                            icon={<MapPin size={17} />}
                            label="Working location"
                            value={registerForm.working_location_id}
                            onChange={(value) =>
                                updateRegisterField("working_location_id", value)
                            }
                            required
                            placeholder="Select working location"
                            options={workingLocations.map((location) => ({
                                value: location.id,
                                label: `${location.name} (${location.type})`,
                            }))}
                        />
                        <SelectField
                            icon={<Building2 size={17} />}
                            label="Department"
                            value={registerForm.department_id}
                            onChange={(value) => updateRegisterField("department_id", value)}
                            placeholder={
                                registerForm.working_location_id
                                    ? organizationLoading
                                        ? "Loading departments"
                                        : "Select department"
                                    : "Select working location first"
                            }
                            disabled={!registerForm.working_location_id || organizationLoading}
                            options={departments.map((department) => ({
                                value: department.id,
                                label: department.name,
                            }))}
                        />
                        <div>
                            <label className="mb-2 block text-sm font-medium">Gender</label>
                            <select
                                value={registerForm.gender}
                                onChange={(event) =>
                                    updateRegisterField("gender", event.target.value)
                                }
                                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-red-500"
                            >
                                <option value="MALE">Male</option>
                                <option value="FEMALE">Female</option>
                            </select>
                        </div>
                        <PasswordField
                            value={registerForm.password}
                            showPassword={showPassword}
                            placeholder="Create password"
                            onChange={(value) => updateRegisterField("password", value)}
                            onToggle={() => setShowPassword((value) => !value)}
                        />
                        <SubmitButton loading={loading} label="Create account" />
                    </form>
                )}
            </section>
        </main>
    );
}

interface InputFieldProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
    type?: string;
    placeholder?: string;
}

function InputField({
    icon,
    label,
    value,
    onChange,
    required = false,
    type = "text",
    placeholder,
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
                    placeholder={placeholder}
                    onChange={(event) => onChange(event.target.value)}
                    required={required}
                    className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm text-[#071426] outline-none placeholder:text-slate-400 focus:border-red-500"
                />
            </div>
        </div>
    );
}

function SelectField({
    icon,
    label,
    value,
    onChange,
    options,
    placeholder,
    required = false,
    disabled = false,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
    placeholder: string;
    required?: boolean;
    disabled?: boolean;
}) {
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
                <select
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    required={required}
                    disabled={disabled}
                    className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-3 text-sm text-[#071426] outline-none focus:border-red-500 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                    <option value="">{placeholder}</option>
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

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
    return (
        <button
            type="submit"
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-70"
        >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {label}
        </button>
    );
}

function PasswordField({
    value,
    showPassword,
    onChange,
    onToggle,
    placeholder = "Enter password",
}: {
    value: string;
    showPassword: boolean;
    onChange: (value: string) => void;
    onToggle: () => void;
    placeholder?: string;
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
                    placeholder={placeholder}
                    onChange={(event) => onChange(event.target.value)}
                    className="h-11 w-full rounded-md border border-slate-300 bg-white pl-10 pr-10 text-sm text-[#071426] outline-none placeholder:text-slate-400 focus:border-red-500"
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
