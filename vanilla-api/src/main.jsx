import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

const API_URL = "http://localhost:8000/api";

async function readJson(response) {
    try {
        return await response.json();
    } catch {
        return {};
    }
}

function getErrorMessage(payload, fallback) {
    const validationErrors = payload.errors
        ? Object.values(payload.errors).flat().join(" ")
        : "";

    return validationErrors || payload.message || fallback;
}

function newestFirst(items) {
    return [...items].sort((a, b) => {
        const createdAtDifference = (Date.parse(b.created_at ?? "") || 0) - (Date.parse(a.created_at ?? "") || 0);
        return createdAtDifference || Number(b.id) - Number(a.id);
    });
}

function App() {
    const [status, setStatus] = useState({ message: "", type: "", loading: false });
    const [posts, setPosts] = useState([]);
    const [postsLoaded, setPostsLoaded] = useState(false);
    const [auth, setAuth] = useState(null);
    const [activePage, setActivePage] = useState(window.location.hash === "#profile" ? "profile" : "feed");
    const [authMode, setAuthMode] = useState("login");
    const [credentials, setCredentials] = useState({ name: "", email: "", password: "", password_confirmation: "" });
    const [authStatus, setAuthStatus] = useState({ message: "", type: "", loading: false });
    const [postStatus, setPostStatus] = useState({ message: "", type: "", loading: false });

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
                const data = JSON.parse(xhr.responseText);
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
            const data = await response.json();
            setPosts(newestFirst(data));
            setPostsLoaded(true);
            setStatus({ message: `fetch: saņemti ${data.length} ieraksti.`, type: "success", loading: false });
        } catch (error) {
            setStatus({ message: `fetch: neizdevās ielādēt datus. ${error.message}`, type: "error", loading: false });
        }
    }

    useEffect(() => {
        function syncPage() {
            setActivePage(window.location.hash === "#profile" && auth ? "profile" : "feed");
        }

        window.addEventListener("hashchange", syncPage);
        syncPage();
        return () => window.removeEventListener("hashchange", syncPage);
    }, [auth]);

    useEffect(() => {
        if (activePage === "profile" && auth && !postsLoaded) {
            loadPostsWithFetch();
        }
    }, [activePage, auth, postsLoaded]);

    async function handleAuthSubmit(event) {
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

            if (!response.ok || !data.token) {
                throw new Error(getErrorMessage(data, registering ? "Neizdevās izveidot kontu." : "Neizdevās pieslēgties."));
            }

            setAuth({ token: data.token, user: data.user });
            setCredentials((current) => ({ ...current, password: "", password_confirmation: "" }));
            setAuthStatus({
                message: registering ? `Account created. Signed in as ${data.user.name}.` : `Signed in as ${data.user.name}.`,
                type: "success",
                loading: false,
            });
        } catch (error) {
            setAuthStatus({ message: error.message, type: "error", loading: false });
        }
    }

    async function handleLogout() {
        setAuthStatus({ message: "Atteicas...", type: "", loading: true });

        try {
            const response = await fetch(`${API_URL}/logout`, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${auth.token}`,
                },
            });
            const data = await readJson(response);

            if (!response.ok) {
                throw new Error(getErrorMessage(data, `Neizdevās atteikties (HTTP ${response.status}).`));
            }

            window.location.hash = "feed";
            setAuth(null);
            setAuthStatus({ message: "Jūs esat atteicies.", type: "success", loading: false });
        } catch (error) {
            setAuthStatus({ message: error.message, type: "error", loading: false });
        }
    }

    async function handleCreatePost(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);

        setPostStatus({ message: "Publicē ierakstu...", type: "", loading: true });

        try {
            const response = await fetch(`${API_URL}/posts`, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${auth.token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    title: formData.get("title"),
                    body: formData.get("body"),
                }),
            });
            const data = await readJson(response);

            if (!response.ok) {
                throw new Error(getErrorMessage(data, `Neizdevās izveidot ierakstu (HTTP ${response.status}).`));
            }

            setPosts((current) => newestFirst([data, ...current.filter((post) => post.id !== data.id)]));
            setPostsLoaded(true);
            form.reset();
            setPostStatus({ message: "Ieraksts veiksmīgi izveidots.", type: "success", loading: false });
        } catch (error) {
            setPostStatus({ message: error.message, type: "error", loading: false });
        }
    }

    const profilePosts = auth
        ? newestFirst(posts.filter((post) => String(post.user_id) === String(auth.user.id)))
        : [];

    return (
        <>
        <header className="site-header">
            <div className="header-inner">
                <a className="brand" href="#feed" aria-label="CodeHUB home">
                    <span className="brand-mark" aria-hidden="true">C</span>
                    <span>Code<span className="brand-accent">HUB</span></span>
                </a>
                {auth && (
                    <div className="header-account">
                        <a className="header-profile" href="#profile" aria-label={`View ${auth.user.name}'s profile`}>
                            <span className="header-avatar" aria-hidden="true">
                                {auth.user.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
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
            <h1>{auth && activePage === "profile" ? "Your profile" : "CodeHUB"}</h1>
            <p className="description">
                {auth && activePage === "profile" ? "Your account and published posts." : "Vanilla JavaScript + AJAX + REST API"}
            </p>

            <div hidden={Boolean(auth && activePage === "profile")}>
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
                                    maxLength="255"
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
                    </div>
                    <form className="create-post-form" onSubmit={handleCreatePost}>
                        <label>
                            Title
                            <input type="text" name="title" maxLength="255" placeholder="Give your post a title" required />
                        </label>
                        <label>
                            Post
                            <textarea name="body" rows="5" placeholder="What would you like to share?" required />
                        </label>
                        <div className="form-footer">
                            {postStatus.message && (
                                <p className={`inline-status ${postStatus.type}`} role="status" aria-live="polite">
                                    {postStatus.loading && <span className="spinner" aria-hidden="true" />}
                                    {postStatus.message}
                                </p>
                            )}
                            <button className="primary-button" type="submit" disabled={postStatus.loading}>
                                {postStatus.loading ? "Publishing..." : "Publish post"}
                            </button>
                        </div>
                    </form>
                </section>
            )}

            <section className="posts-section" aria-labelledby="posts-title" hidden={Boolean(auth && activePage === "profile")}>
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
                            {auth.user.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
                        </div>
                        <div className="profile-details">
                            <span className="eyebrow">YOUR PROFILE</span>
                            <h2 id="profile-title">{auth.user.name}</h2>
                            <p>{auth.user.email}</p>
                            {auth.user.created_at && (
                                <small>Member since {new Date(auth.user.created_at).toLocaleDateString()}</small>
                            )}
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
        </main>
        </>
    );
}

createRoot(document.getElementById("root")).render(<App />);
