const API_URL = "http://localhost:8000/api";

const loadPostsXHRButton = document.getElementById("loadPostsXHR");
const loadPostsFetchButton = document.getElementById("loadPostsFetch");
const postsContainer = document.getElementById("posts");
const statusElement = document.getElementById("status");

function setStatus(message, type = "", loading = false) {
    statusElement.className = type;
    statusElement.setAttribute("role", "status");
    statusElement.setAttribute("aria-live", "polite");
    statusElement.replaceChildren();

    if (loading) {
        const spinner = document.createElement("span");
        spinner.className = "spinner";
        spinner.setAttribute("aria-hidden", "true");
        statusElement.appendChild(spinner);
    }

    statusElement.appendChild(document.createTextNode(message));
}

function renderPosts(posts) {
    postsContainer.innerHTML = "";

    if (posts.length === 0) {
        postsContainer.innerHTML = "<p>API nav atrasts neviens ieraksts.</p>";
        return;
    }

    posts.forEach(function (post) {
        const article = document.createElement("article");
        article.classList.add("post");

        const title = document.createElement("h2");
        title.textContent = post.title;

        const body = document.createElement("p");
        body.textContent = post.body;

        const id = document.createElement("small");
        id.textContent = `ID: ${post.id}`;

        article.appendChild(title);
        article.appendChild(body);
        article.appendChild(id);

        postsContainer.appendChild(article);
    });
}

function loadPostsWithXHR() {
    setStatus("XMLHttpRequest: ielādē datus...", "", true);
    postsContainer.innerHTML = "";

    const xhr = new XMLHttpRequest();
    xhr.open("GET", `${API_URL}/posts`, true);
    xhr.setRequestHeader("Accept", "application/json");

    xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
            const posts = JSON.parse(xhr.responseText);
            setStatus(`XMLHttpRequest: saņemti ${posts.length} ieraksti.`, "success");
            renderPosts(posts);
        } else {
            setStatus(`XMLHttpRequest: kļūda. HTTP ${xhr.status}`, "error");
        }
    };

    xhr.onerror = function () {
        setStatus("XMLHttpRequest: neizdevās savienoties ar API.", "error");
    };

    xhr.send();
}

async function loadPostsWithFetch() {
    setStatus("fetch: ielādē datus...", "", true);
    postsContainer.innerHTML = "";

    try {
        const response = await fetch(`${API_URL}/posts`, {
            headers: {
                Accept: "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const posts = await response.json();
        setStatus(`fetch: saņemti ${posts.length} ieraksti.`, "success");
        renderPosts(posts);
    } catch (error) {
        setStatus(`fetch: neizdevās ielādēt datus. ${error.message}`, "error");
    }
}

loadPostsXHRButton.addEventListener("click", loadPostsWithXHR);
loadPostsFetchButton.addEventListener("click", loadPostsWithFetch);