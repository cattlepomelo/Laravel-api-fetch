import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const API_URL = "http://localhost:8000/api";
const AUTH_STORAGE_KEY = "codehub-auth";

type Post = {
    id: number | string;
    user_id: number | string;
    title: string;
    body: string;
    created_at?: string | null;
};

type User = {
    id: number | string;
    name: string;
    email: string;
    profile_picture_url?: string | null;
    created_at?: string | null;
};

type Auth = {
    token: string;
    user: User;
};

type Status = {
    message: string;
    type: "" | "error" | "success";
    loading: boolean;
};

type Credentials = {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
};

type PostDraft = {
    title: string;
    body: string;
};

type ApiPayload = {
    errors?: Record<string, string | string[]>;
    message?: string;
    token?: string;
    user?: User;
    id?: number | string;
    user_id?: number | string;
    title?: string;
    body?: string;
    error?: boolean;
    type?: string;
    joke?: string;
    setup?: string;
    delivery?: string;
};

type Page = "feed" | "profile" | "corn";
type AuthMode = "login" | "register";

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function isUser(value: unknown): value is User {
    if (typeof value !== "object" || value === null) return false;

    const user = value as Record<string, unknown>;
    return (typeof user.id === "number" || typeof user.id === "string")
        && typeof user.name === "string"
        && typeof user.email === "string"
        && (user.profile_picture_url === undefined || typeof user.profile_picture_url === "string" || user.profile_picture_url === null)
        && (user.created_at === undefined || typeof user.created_at === "string" || user.created_at === null);
}

function isPost(value: ApiPayload): value is ApiPayload & Post {
    return (typeof value.id === "number" || typeof value.id === "string")
        && (typeof value.user_id === "number" || typeof value.user_id === "string")
        && typeof value.title === "string"
        && typeof value.body === "string";
}

function readStoredAuth(): Auth | null {
    const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!storedAuth) return null;

    try {
        const value: unknown = JSON.parse(storedAuth);
        if (typeof value === "object" && value !== null) {
            const candidate = value as Record<string, unknown>;
            if (typeof candidate.token === "string" && isUser(candidate.user)) {
                return { token: candidate.token, user: candidate.user };
            }
        }
    } catch (error) {
        console.error("Unable to read the saved sign-in session.", error);
    }

    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
}

async function readJson(response: Response): Promise<ApiPayload> {
    try {
        return await response.json() as ApiPayload;
    } catch {
        return {};
    }
}

function getErrorMessage(payload: ApiPayload, fallback: string): string {
    const validationErrors = payload.errors
        ? Object.values(payload.errors).flat().join(" ")
        : "";

    return validationErrors || payload.message || fallback;
}

function newestFirst(items: Post[]): Post[] {
    return [...items].sort((a, b) => {
        const createdAtDifference = (Date.parse(b.created_at ?? "") || 0) - (Date.parse(a.created_at ?? "") || 0);
        return createdAtDifference || Number(b.id) - Number(a.id);
    });
}

function CornIllustration({ variant }: { variant: number }) {
    const kernelRows = Array.from({ length: 8 }, (_, row) => (
        Array.from({ length: 4 }, (_, column) => ({
            cx: 70 + column * 13 + (row % 2) * 6,
            cy: 45 + row * 17,
        }))
    )).flat();

    return (
        <svg className={`corn-illustration corn-illustration-${variant % 4}`} viewBox="0 0 180 220" role="img" aria-label="Illustration of an ear of corn">
            <defs>
                <linearGradient id={`corn-husk-${variant}`} x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0" stopColor="#91b84b" />
                    <stop offset="1" stopColor="#456b2c" />
                </linearGradient>
                <linearGradient id={`corn-cob-${variant}`} x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0" stopColor={variant % 2 ? "#ffe58b" : "#ffd34f"} />
                    <stop offset="1" stopColor={variant % 2 ? "#e6a92f" : "#ecaa27"} />
                </linearGradient>
            </defs>
            <path d="M84 204C67 176 37 149 35 112C33 79 50 42 80 20C75 70 88 128 104 174Z" fill={`url(#corn-husk-${variant})`} stroke="#314c25" strokeWidth="3" strokeLinejoin="round" />
            <path d="M97 203C115 172 145 143 147 107C149 75 130 39 101 19C107 68 93 129 78 175Z" fill={`url(#corn-husk-${variant})`} stroke="#314c25" strokeWidth="3" strokeLinejoin="round" />
            <path d="M90 24C112 24 126 44 126 73V146C126 169 111 186 90 194C69 186 54 169 54 146V73C54 44 68 24 90 24Z" fill={`url(#corn-cob-${variant})`} stroke="#a87420" strokeWidth="3" />
            {kernelRows.map((kernel, index) => (
                <circle key={index} cx={kernel.cx} cy={kernel.cy} r="5.2" fill={index % 3 === variant % 3 ? "#fff0a8" : "#f5c543"} stroke="#d79b29" strokeWidth="1.4" />
            ))}
        </svg>
    );
}

function App() {
    const [status, setStatus] = useState<Status>({ message: "", type: "", loading: false });
    const [posts, setPosts] = useState<Post[]>([]);
    const [postsLoaded, setPostsLoaded] = useState(false);
    const [auth, setAuth] = useState<Auth | null>(readStoredAuth);
    const [activePage, setActivePage] = useState<Page>(
        ["#feed", "#profile", "#corn"].includes(window.location.hash) ? window.location.hash.slice(1) as Page : "feed",
    );
    const [cornAgeConfirmed, setCornAgeConfirmed] = useState(false);
    const [authMode, setAuthMode] = useState<AuthMode>("login");
    const [credentials, setCredentials] = useState<Credentials>({ name: "", email: "", password: "", password_confirmation: "" });
    const [authStatus, setAuthStatus] = useState<Status>({ message: "", type: "", loading: false });
    const [postStatus, setPostStatus] = useState<Status>({ message: "", type: "", loading: false });
    const [jokeStatus, setJokeStatus] = useState<Status>({ message: "", type: "", loading: false });
    const [postDraft, setPostDraft] = useState<PostDraft>({ title: "", body: "" });
    const [pictureStatus, setPictureStatus] = useState<Status>({ message: "", type: "", loading: false });

    function loadPostsWithXHR() {
        setStatus({ message: "XMLHttpRequest: ielādē datus...", type: "", loading: true });
        const xhr = new XMLHttpRequest();
        xhr.open("GET", `${API_URL}/posts`, true);
        xhr.setRequestHeader("Accept", "application/json");
        xhr.onload = () => {
            if (xhr.status < 200 || xhr.status >= 300) {
                setStatus({ message: `XMLHttpRequest: kļūda. HTTP ${xhr.status}`, type: "error", loading: false });
                return;
            }
            try {
                const data = JSON.parse(xhr.responseText) as Post[];
                setPosts(newestFirst(data));
                setPostsLoaded(true);
                setStatus({ message: `XMLHttpRequest: saņemti ${data.length} ieraksti.`, type: "success", loading: false });
            } catch {
                setStatus({ message: "XMLHttpRequest: nederīga API atbilde.", type: "error", loading: false });
            }
        };
        xhr.onerror = () => {
            setStatus({ message: "XMLHttpRequest: neizdevās savienoties ar API.", type: "error", loading: false });
        };
        xhr.send();
    }

    async function loadPostsWithFetch() {
        setStatus({ message: "fetch: ielādē datus...", type: "", loading: true });
        try {
            const response = await fetch(`${API_URL}/posts`, {
                headers: { Accept: "application/json" },
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json() as Post[];
            setPosts(newestFirst(data));
            setPostsLoaded(true);
            setStatus({ message: `fetch: saņemti ${data.length} ieraksti.`, type: "success", loading: false });
        } catch (error) {
            setStatus({ message: `fetch: neizdevās ielādēt datus. ${errorMessage(error)}`, type: "error", loading: false });
        }
    }

    useEffect(() => {
        function syncPage() {
            const page = window.location.hash.slice(1);
            setActivePage(page === "corn" ? "corn" : page === "profile" && auth ? "profile" : "feed");
        }

        window.addEventListener("hashchange", syncPage);
        syncPage();
        return () => window.removeEventListener("hashchange", syncPage);
    }, [auth]);

    useEffect(() => {
        const savedAuth = readStoredAuth();
        if (!savedAuth) return;
        const authToValidate: Auth = savedAuth;

        let cancelled = false;
        async function validateSavedAuth() {
            try {
                const response = await fetch(`${API_URL}/user`, {
                    headers: {
                        Accept: "application/json",
                        Authorization: `Bearer ${authToValidate.token}`,
                    },
                });

                if (response.status === 401 || response.status === 403) {
                    localStorage.removeItem(AUTH_STORAGE_KEY);
                    if (!cancelled) setAuth(null);
                    return;
                }
                if (!response.ok) throw new Error(`Unable to restore session (HTTP ${response.status}).`);

                const data = await readJson(response);
                if (!isUser(data)) throw new Error("API returned an invalid user.");

                if (!cancelled) {
                    const restoredAuth = { ...authToValidate, user: data };
                    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(restoredAuth));
                    setAuth(restoredAuth);
                }
            } catch (error) {
                if (!cancelled) {
                    setAuthStatus({ message: `Unable to verify saved session: ${errorMessage(error)}`, type: "error", loading: false });
                }
            }
        }

        void validateSavedAuth();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (activePage === "profile" && auth && !postsLoaded) {
            loadPostsWithFetch();
        }
    }, [activePage, auth, postsLoaded]);

    async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const registering = authMode === "register";
        setAuthStatus({ message: registering ? "Creating account..." : "Signing in...", type: "", loading: true });

        try {
            const response = await fetch(`${API_URL}/${authMode}`, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(registering
                    ? credentials
                    : { email: credentials.email, password: credentials.password }),
            });
            const data = await readJson(response);

            if (!response.ok || !data.token || !isUser(data.user)) {
                throw new Error(getErrorMessage(data, registering ? "Neizdevās izveidot kontu." : "Neizdevās pieslēgties."));
            }

            const nextAuth = { token: data.token, user: data.user };
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextAuth));
            setAuth(nextAuth);
            setCredentials((current) => ({ ...current, password: "", password_confirmation: "" }));
            setAuthStatus({
                message: registering ? `Account created. Signed in as ${data.user.name}.` : `Signed in as ${data.user.name}.`,
                type: "success",
                loading: false,
            });
        } catch (error) {
            setAuthStatus({ message: errorMessage(error), type: "error", loading: false });
        }
    }

    async function handleLogout() {
        setAuthStatus({ message: "Atteicas...", type: "", loading: true });

        try {
            const currentAuth = auth;
            if (!currentAuth) throw new Error("You must be signed in to sign out.");

            const response = await fetch(`${API_URL}/logout`, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${currentAuth.token}`,
                },
            });
            const data = await readJson(response);

            if (!response.ok) {
                throw new Error(getErrorMessage(data, `Neizdevās atteikties (HTTP ${response.status}).`));
            }

            window.location.hash = "feed";
            localStorage.removeItem(AUTH_STORAGE_KEY);
            setAuth(null);
            setAuthStatus({ message: "Jūs esat atteicies.", type: "success", loading: false });
        } catch (error) {
            setAuthStatus({ message: errorMessage(error), type: "error", loading: false });
        }
    }

    async function handleProfilePictureSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        setPictureStatus({ message: "Uploading picture...", type: "", loading: true });

        try {
            const currentAuth = auth;
            if (!currentAuth) throw new Error("You must be signed in to upload a profile picture.");

            const response = await fetch(`${API_URL}/user/profile-picture`, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${currentAuth.token}`,
                },
                body: formData,
            });
            const data = await readJson(response);

            if (!response.ok || !isUser(data.user)) {
                throw new Error(getErrorMessage(data, `Unable to upload picture (HTTP ${response.status}).`));
            }

            const user = data.user;
            setAuth((current) => current ? { ...current, user } : current);
            form.reset();
            setPictureStatus({ message: "Profile picture updated.", type: "success", loading: false });
        } catch (error) {
            setPictureStatus({ message: errorMessage(error), type: "error", loading: false });
        }
    }

    async function handleGenerateJoke() {
        setJokeStatus({ message: "Finding a programming joke...", type: "", loading: true });

        try {
            const response = await fetch("https://v2.jokeapi.dev/joke/Programming?safe-mode", {
                headers: { Accept: "application/json" },
            });
            const data = await readJson(response);

            if (!response.ok || data.error) {
                throw new Error(data.message || `Joke API returned HTTP ${response.status}.`);
            }

            const body = data.type === "single" && typeof data.joke === "string"
                ? data.joke
                : data.type === "twopart" && typeof data.setup === "string" && typeof data.delivery === "string"
                    ? `${data.setup}\n\n${data.delivery}`
                    : "";

            if (typeof body !== "string" || !body.trim()) {
                throw new Error("Joke API returned an unsupported joke format.");
            }

            setPostDraft({ title: "Programming joke", body });
            setJokeStatus({ message: "Joke added to your draft. Edit it or publish when ready.", type: "success", loading: false });
        } catch (error) {
            setJokeStatus({ message: `Unable to generate a joke: ${errorMessage(error)}`, type: "error", loading: false });
        }
    }

    async function handleCreatePost(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        setPostStatus({ message: "Publicē ierakstu...", type: "", loading: true });

        try {
            const currentAuth = auth;
            if (!currentAuth) throw new Error("You must be signed in to create a post.");

            const response = await fetch(`${API_URL}/posts`, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${currentAuth.token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    title: postDraft.title,
                    body: postDraft.body,
                }),
            });
            const data = await readJson(response);

            if (!response.ok) {
                throw new Error(getErrorMessage(data, `Neizdevās izveidot ierakstu (HTTP ${response.status}).`));
            }
            if (!isPost(data)) {
                throw new Error("API returned an invalid post.");
            }

            setPosts((current) => newestFirst([data, ...current.filter((post) => post.id !== data.id)]));
            setPostsLoaded(true);
            setPostDraft({ title: "", body: "" });
            setJokeStatus({ message: "", type: "", loading: false });
            setPostStatus({ message: "Ieraksts veiksmīgi izveidots.", type: "success", loading: false });
        } catch (error) {
            setPostStatus({ message: errorMessage(error), type: "error", loading: false });
        }
    }

    const profilePosts = auth
        ? newestFirst(posts.filter((post) => String(post.user_id) === String(auth.user.id)))
        : [];

    function confirmCornAge(): void {
        setCornAgeConfirmed(true);
    }

    function leaveCornPage(): void {
        window.location.hash = "feed";
        setActivePage("feed");
    }

    return (
        <>
            <header className="site-header">
                <div className="header-inner">
                    <a className="brand" href="#feed" aria-label="CodeHUB home">
                        <span className="brand-mark" aria-hidden="true">C</span>
                        <span>Code<span className="brand-accent">HUB</span></span>
                    </a>
                    <a className="header-watch-corn" href="#corn" aria-current={activePage === "corn" ? "page" : undefined}>
                        Watch corn
                    </a>
                    {auth && (
                        <div className="header-account">
                            <a className="header-profile" href="#profile" aria-label={`View ${auth.user.name}'s profile`}>
                                <span className="header-avatar" aria-hidden="true">
                                    {auth.user.profile_picture_url
                                        ? <img src={auth.user.profile_picture_url} alt="" />
                                        : auth.user.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
                                </span>
                                <span className="header-user-name">{auth.user.name}</span>
                            </a>
                            <button className="header-signout" type="button" onClick={handleLogout} disabled={authStatus.loading}>
                                {authStatus.loading ? "Signing out..." : "Sign out"}
                            </button>
                        </div>
                    )}
                </div>
            </header>
            <main className="container">
                <h1>{activePage === "corn" ? "Corn gallery" : auth && activePage === "profile" ? "Your profile" : "CodeHUB"}</h1>
                <p className="description">
                    {activePage === "corn"
                        ? "A whole page of golden, glorious corn."
                        : auth && activePage === "profile"
                        ? "Your account and published posts."
                        : <span className="description-highlight">Total mindfuck</span>}
                </p>

                <div hidden={activePage !== "feed"}>
                    {!auth && <section className="auth-panel" aria-labelledby="auth-title">
                        <div className="section-heading">
                            <div>
                                <span className="eyebrow">YOUR ACCOUNT</span>
                                <h2 id="auth-title">{authMode === "register" ? "Create an account" : "Sign in to create posts"}</h2>
                            </div>
                        </div>

                        <form className="login-form" onSubmit={handleAuthSubmit}>
                            {authMode === "register" && (
                                <label>
                                    Name
                                    <input
                                        type="text"
                                        name="name"
                                        autoComplete="name"
                                        maxLength={255}
                                        required
                                        value={credentials.name}
                                        onChange={(event) => setCredentials((current) => ({ ...current, name: event.target.value }))}
                                    />
                                </label>
                            )}
                            <label>
                                Email
                                <input
                                    type="email"
                                    name="email"
                                    autoComplete="email"
                                    required
                                    value={credentials.email}
                                    onChange={(event) => setCredentials((current) => ({ ...current, email: event.target.value }))}
                                />
                            </label>
                            <label>
                                Password
                                <input
                                    type="password"
                                    name="password"
                                    autoComplete="current-password"
                                    required
                                    value={credentials.password}
                                    onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))}
                                />
                            </label>
                            {authMode === "register" && (
                                <label>
                                    Confirm password
                                    <input
                                        type="password"
                                        name="password_confirmation"
                                        autoComplete="new-password"
                                        required
                                        value={credentials.password_confirmation}
                                        onChange={(event) => setCredentials((current) => ({ ...current, password_confirmation: event.target.value }))}
                                    />
                                </label>
                            )}
                            <div className="auth-actions">
                                <button className="primary-button" type="submit" disabled={authStatus.loading}>
                                    {authStatus.loading
                                        ? authMode === "register" ? "Creating account..." : "Signing in..."
                                        : authMode === "register" ? "Create account" : "Sign in"}
                                </button>
                                <button
                                    className="text-button"
                                    type="button"
                                    onClick={() => {
                                        setAuthMode((current) => current === "login" ? "register" : "login");
                                        setAuthStatus({ message: "", type: "", loading: false });
                                    }}
                                >
                                    {authMode === "register" ? "Already have an account? Sign in" : "New here? Create an account"}
                                </button>
                            </div>
                        </form>
                        {authStatus.message && (
                            <p className={`inline-status ${authStatus.type}`} role="status" aria-live="polite">
                                {authStatus.message}
                            </p>
                        )}
                    </section>}
                </div>

                {auth && activePage === "feed" && (
                    <section className="create-post-panel" aria-labelledby="create-post-title">
                        <div className="section-heading">
                            <div>
                                <span className="eyebrow">NEW POST</span>
                                <h2 id="create-post-title">Share something</h2>
                            </div>
                            <button
                                className="secondary-button generate-joke-button"
                                type="button"
                                onClick={handleGenerateJoke}
                                disabled={jokeStatus.loading}
                            >
                                {jokeStatus.loading ? "Generating..." : "Generate programming joke"}
                            </button>
                        </div>
                        <form className="create-post-form" onSubmit={handleCreatePost}>
                            <label>
                                Title
                                <input
                                    type="text"
                                    name="title"
                                    maxLength={255}
                                    placeholder="Give your post a title"
                                    value={postDraft.title}
                                    onChange={(event) => setPostDraft((current) => ({ ...current, title: event.target.value }))}
                                    required
                                />
                            </label>
                            <label>
                                Post
                                <textarea
                                    name="body"
                                    rows={5}
                                    placeholder="What would you like to share?"
                                    value={postDraft.body}
                                    onChange={(event) => setPostDraft((current) => ({ ...current, body: event.target.value }))}
                                    required
                                />
                            </label>
                            <div className="form-footer">
                                <div className="composer-statuses">
                                    {jokeStatus.message && (
                                        <p className={`inline-status ${jokeStatus.type}`} role="status" aria-live="polite">
                                            {jokeStatus.loading && <span className="spinner" aria-hidden="true" />}
                                            {jokeStatus.message}
                                        </p>
                                    )}
                                    {postStatus.message && (
                                        <p className={`inline-status ${postStatus.type}`} role="status" aria-live="polite">
                                            {postStatus.loading && <span className="spinner" aria-hidden="true" />}
                                            {postStatus.message}
                                        </p>
                                    )}
                                </div>
                                <button className="primary-button" type="submit" disabled={postStatus.loading}>
                                    {postStatus.loading ? "Publishing..." : "Publish post"}
                                </button>
                            </div>
                        </form>
                    </section>
                )}

                <section className="posts-section" aria-labelledby="posts-title" hidden={activePage !== "feed"}>
                    <div className="section-heading posts-heading">
                        <div>
                            <span className="eyebrow">API EXPLORER</span>
                            <h2 id="posts-title">Posts</h2>
                        </div>
                        <div className="button-group">
                            <button className="secondary-button" onClick={loadPostsWithXHR}>
                                Load with XMLHttpRequest
                            </button>
                            <button className="secondary-button" onClick={loadPostsWithFetch}>
                                Load with fetch
                            </button>
                        </div>
                    </div>
                    <div id="status" className={status.type} role="status" aria-live="polite">
                        {status.loading && <span className="spinner" aria-hidden="true" />}
                        {status.message}
                    </div>
                    <div id="posts">
                        {posts.length === 0 && status.message && !status.loading ? (
                            <p>API nav atrasts neviens ieraksts.</p>
                        ) : (
                            newestFirst(posts).map((post) => (
                                <article className="post" key={post.id}>
                                    <h2>{post.title}</h2>
                                    <p>{post.body}</p>
                                    <small>ID: {post.id}</small>
                                </article>
                            ))
                        )}
                    </div>
                </section>

                {auth && activePage === "profile" && (
                    <section className="profile-page" aria-labelledby="profile-title">
                        <div className="profile-card">
                            <div className="profile-avatar" aria-hidden="true">
                                {auth.user.profile_picture_url
                                    ? <img src={auth.user.profile_picture_url} alt="" />
                                    : auth.user.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
                            </div>
                            <div className="profile-details">
                                <span className="eyebrow">YOUR PROFILE</span>
                                <h2 id="profile-title">{auth.user.name}</h2>
                                <p>{auth.user.email}</p>
                                {auth.user.created_at && (
                                    <small>Member since {new Date(auth.user.created_at).toLocaleDateString()}</small>
                                )}
                                <form className="picture-upload-form" onSubmit={handleProfilePictureSubmit}>
                                    <label>
                                        Profile picture
                                        <input type="file" name="profile_picture" accept="image/jpeg,image/png,image/webp" required />
                                    </label>
                                    <button className="secondary-button" type="submit" disabled={pictureStatus.loading}>
                                        {pictureStatus.loading ? "Uploading..." : "Upload picture"}
                                    </button>
                                    {pictureStatus.message && (
                                        <p className={`inline-status ${pictureStatus.type}`} role="status" aria-live="polite">
                                            {pictureStatus.message}
                                        </p>
                                    )}
                                </form>
                            </div>
                            <div className="profile-post-count">
                                <strong>{profilePosts.length}</strong>
                                <span>{profilePosts.length === 1 ? "POST" : "POSTS"}</span>
                            </div>
                        </div>

                        <div className="section-heading profile-post-heading">
                            <div>
                                <span className="eyebrow">YOUR ACTIVITY</span>
                                <h2>Your posts</h2>
                            </div>
                        </div>
                        {status.loading && !postsLoaded ? (
                            <p className="profile-empty"><span className="spinner" aria-hidden="true" /> Loading your posts...</p>
                        ) : status.type === "error" && !postsLoaded ? (
                            <div className="profile-empty">
                                <p>{status.message}</p>
                                <button className="secondary-button" onClick={loadPostsWithFetch}>Try again</button>
                            </div>
                        ) : (
                            <div className="profile-posts">
                                {profilePosts.length === 0 ? (
                                    <p className="profile-empty">You have not published any posts yet.</p>
                                ) : (
                                    profilePosts.map((post) => (
                                        <article className="post" key={post.id}>
                                            <h2>{post.title}</h2>
                                            <p>{post.body}</p>
                                            <small>ID: {post.id}</small>
                                        </article>
                                    ))
                                )}
                            </div>
                        )}
                    </section>
                )}

                {activePage === "corn" && !cornAgeConfirmed && (
                    <section className="age-gate" aria-labelledby="age-gate-title">
                        <span className="eyebrow">CORN GALLERY</span>
                        <h2 id="age-gate-title">Are you 18 or older?</h2>
                        <p>Please confirm your age before viewing the corn gallery.</p>
                        <div className="age-gate-actions">
                            <button className="primary-button" type="button" onClick={confirmCornAge}>Yes, I’m 18 or older</button>
                            <button className="secondary-button" type="button" onClick={leaveCornPage}>No, take me back</button>
                        </div>
                    </section>
                )}

                {activePage === "corn" && cornAgeConfirmed && (
                    <section className="corn-gallery" aria-label="Corn picture gallery">
                        {Array.from({ length: 12 }, (_, index) => (
                            <article className="corn-card" key={index}>
                                <div className="corn-picture">
                                    <CornIllustration variant={index} />
                                </div>
                                <p>{["Golden hour", "Kernel of truth", "Corn field day", "Cobsolutely lovely"][index % 4]}</p>
                            </article>
                        ))}
                    </section>
                )}
            </main>
        </>
    );
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found.");
createRoot(rootElement).render(<App />);
