// Configuration
const REPO_OWNER = 'XavierKain';
const REPO_NAME = 'paraflightlog-wings';
const BRANCH = 'main';

// State
let catalog = null;
let githubToken = null;
let pendingDeleteId = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check for saved token
    githubToken = localStorage.getItem('github_token');
    if (githubToken) {
        validateToken();
    }

    // Load catalog
    refreshCatalog();

    // Image preview
    document.getElementById('wing-image').addEventListener('change', handleImagePreview);
});

// Auth functions
function showLoginModal() {
    document.getElementById('login-modal').classList.add('show');
}

async function login() {
    const token = document.getElementById('github-token').value.trim();
    if (!token) return;

    githubToken = token;

    try {
        const response = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `token ${token}` }
        });

        if (response.ok) {
            const user = await response.json();
            localStorage.setItem('github_token', token);
            showLoggedIn(user.login);
            closeModal('login-modal');
        } else {
            alert('Token invalide');
            githubToken = null;
        }
    } catch (error) {
        alert('Erreur de connexion: ' + error.message);
        githubToken = null;
    }
}

async function validateToken() {
    try {
        const response = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `token ${githubToken}` }
        });

        if (response.ok) {
            const user = await response.json();
            showLoggedIn(user.login);
        } else {
            logout();
        }
    } catch {
        logout();
    }
}

function showLoggedIn(username) {
    document.getElementById('login-btn').style.display = 'none';
    document.getElementById('user-info').style.display = 'flex';
    document.getElementById('username').textContent = username;
    document.getElementById('add-wing-btn').disabled = false;
}

function logout() {
    githubToken = null;
    localStorage.removeItem('github_token');
    document.getElementById('login-btn').style.display = 'block';
    document.getElementById('user-info').style.display = 'none';
    document.getElementById('add-wing-btn').disabled = true;
}

// Catalog functions
async function refreshCatalog() {
    try {
        const response = await fetch(`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/wings.json?t=${Date.now()}`);
        catalog = await response.json();
        renderCatalog();
        updateStats();
    } catch (error) {
        document.getElementById('wing-list').innerHTML = '<p class="loading">Erreur de chargement</p>';
        console.error('Failed to load catalog:', error);
    }
}

function updateStats() {
    document.getElementById('wing-count').textContent = catalog.wings.length;
    document.getElementById('manufacturer-count').textContent = catalog.manufacturers.length;

    const date = new Date(catalog.lastUpdated);
    document.getElementById('last-update').textContent = date.toLocaleDateString('fr-FR');
}

function renderCatalog() {
    const container = document.getElementById('wing-list');

    if (!catalog || !catalog.wings.length) {
        container.innerHTML = '<p class="loading">Aucune voile dans le catalogue</p>';
        return;
    }

    container.innerHTML = catalog.wings.map(wing => {
        const manufacturer = catalog.manufacturers.find(m => m.id === wing.manufacturer);
        const imageUrl = wing.imageUrl
            ? `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${wing.imageUrl}?t=${Date.now()}`
            : null;

        return `
            <div class="wing-card">
                ${imageUrl
                    ? `<img src="${imageUrl}" alt="${wing.fullName}" class="wing-image">`
                    : `<div class="wing-image no-image">🪂</div>`
                }
                <div class="wing-info">
                    <div class="wing-name">${wing.fullName}</div>
                    <div class="wing-meta">${manufacturer?.name || 'Inconnu'} • ${wing.type}${wing.year ? ` • ${wing.year}` : ''}</div>
                    <div class="wing-sizes">
                        ${wing.sizes.map(s => `<span class="size-tag">${s}m</span>`).join('')}
                    </div>
                </div>
                <div class="wing-actions">
                    <button class="edit-btn" onclick="editWing('${wing.id}')">Modifier</button>
                    <button class="delete-btn" onclick="deleteWing('${wing.id}')">Supprimer</button>
                </div>
            </div>
        `;
    }).join('');
}

// Modal functions
function closeModal(id) {
    document.getElementById(id).classList.remove('show');
}

function showAddWingModal() {
    document.getElementById('wing-modal-title').textContent = 'Ajouter une voile';
    document.getElementById('wing-form').reset();
    document.getElementById('wing-id').value = '';
    document.getElementById('image-preview').innerHTML = '';

    // Populate manufacturer select
    const select = document.getElementById('wing-manufacturer');
    select.innerHTML = '<option value="">Sélectionner...</option>' +
        catalog.manufacturers.map(m => `<option value="${m.id}">${m.name}</option>`).join('');

    document.getElementById('wing-modal').classList.add('show');
}

function editWing(id) {
    const wing = catalog.wings.find(w => w.id === id);
    if (!wing) return;

    document.getElementById('wing-modal-title').textContent = 'Modifier la voile';
    document.getElementById('wing-id').value = wing.id;

    // Populate manufacturer select
    const select = document.getElementById('wing-manufacturer');
    select.innerHTML = '<option value="">Sélectionner...</option>' +
        catalog.manufacturers.map(m => `<option value="${m.id}" ${m.id === wing.manufacturer ? 'selected' : ''}>${m.name}</option>`).join('');

    document.getElementById('wing-model').value = wing.model;
    document.getElementById('wing-type').value = wing.type;
    document.getElementById('wing-year').value = wing.year || '';
    document.getElementById('wing-sizes').value = wing.sizes.join(', ');

    // Show current image
    if (wing.imageUrl) {
        const imageUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}/${wing.imageUrl}?t=${Date.now()}`;
        document.getElementById('image-preview').innerHTML = `<img src="${imageUrl}" alt="Preview">`;
    } else {
        document.getElementById('image-preview').innerHTML = '';
    }

    document.getElementById('wing-modal').classList.add('show');
}

function handleImagePreview(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('image-preview').innerHTML = `<img src="${e.target.result}" alt="Preview">`;
    };
    reader.readAsDataURL(file);
}

// Save wing
async function saveWing(event) {
    event.preventDefault();

    if (!githubToken) {
        alert('Veuillez vous connecter');
        return;
    }

    const id = document.getElementById('wing-id').value;
    const manufacturer = document.getElementById('wing-manufacturer').value;
    const model = document.getElementById('wing-model').value.trim();
    const type = document.getElementById('wing-type').value;
    const year = document.getElementById('wing-year').value ? parseInt(document.getElementById('wing-year').value) : null;
    const sizes = document.getElementById('wing-sizes').value.split(',').map(s => s.trim()).filter(s => s);
    const imageFile = document.getElementById('wing-image').files[0];

    const manufacturerObj = catalog.manufacturers.find(m => m.id === manufacturer);
    const fullName = manufacturerObj ? `${manufacturerObj.name} ${model}` : model;
    const wingId = id || `${manufacturer}-${model.toLowerCase().replace(/\s+/g, '-')}`;
    const imageFilename = `images/${wingId}.png`;

    // Prepare wing object
    const wing = {
        id: wingId,
        manufacturer,
        model,
        fullName,
        type,
        sizes,
        imageUrl: imageFile ? imageFilename : (catalog.wings.find(w => w.id === id)?.imageUrl || null),
        year
    };

    try {
        // Upload image if provided
        if (imageFile) {
            await uploadImage(imageFile, imageFilename);
        }

        // Update catalog
        if (id) {
            const index = catalog.wings.findIndex(w => w.id === id);
            if (index !== -1) {
                catalog.wings[index] = wing;
            }
        } else {
            catalog.wings.push(wing);
        }

        catalog.lastUpdated = new Date().toISOString();

        // Save catalog
        await saveCatalog();

        closeModal('wing-modal');
        renderCatalog();
        updateStats();

        alert('Voile sauvegardée !');
    } catch (error) {
        alert('Erreur: ' + error.message);
        console.error('Save error:', error);
    }
}

// Delete wing
function deleteWing(id) {
    const wing = catalog.wings.find(w => w.id === id);
    if (!wing) return;

    pendingDeleteId = id;
    document.getElementById('delete-wing-name').textContent = wing.fullName;
    document.getElementById('delete-modal').classList.add('show');
}

async function confirmDelete() {
    if (!pendingDeleteId || !githubToken) return;

    const wing = catalog.wings.find(w => w.id === pendingDeleteId);

    try {
        // Delete image if exists
        if (wing?.imageUrl) {
            await deleteFile(wing.imageUrl);
        }

        // Update catalog
        catalog.wings = catalog.wings.filter(w => w.id !== pendingDeleteId);
        catalog.lastUpdated = new Date().toISOString();

        await saveCatalog();

        closeModal('delete-modal');
        pendingDeleteId = null;
        renderCatalog();
        updateStats();

        alert('Voile supprimée !');
    } catch (error) {
        alert('Erreur: ' + error.message);
        console.error('Delete error:', error);
    }
}

// GitHub API functions
async function getFileSha(path) {
    try {
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${BRANCH}`, {
            headers: { 'Authorization': `token ${githubToken}` }
        });

        if (response.ok) {
            const data = await response.json();
            return data.sha;
        }
    } catch {
        // File doesn't exist
    }
    return null;
}

async function uploadImage(file, path) {
    const sha = await getFileSha(path);

    // Read file as base64
    const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(file);
    });

    const body = {
        message: `Update ${path}`,
        content: base64,
        branch: BRANCH
    };

    if (sha) {
        body.sha = sha;
    }

    const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${githubToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        throw new Error('Failed to upload image');
    }
}

async function deleteFile(path) {
    const sha = await getFileSha(path);
    if (!sha) return;

    await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `token ${githubToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: `Delete ${path}`,
            sha,
            branch: BRANCH
        })
    });
}

async function saveCatalog() {
    const sha = await getFileSha('wings.json');
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(catalog, null, 2))));

    const body = {
        message: 'Update wing catalog',
        content,
        branch: BRANCH
    };

    if (sha) {
        body.sha = sha;
    }

    const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/wings.json`, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${githubToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        throw new Error('Failed to save catalog');
    }
}
