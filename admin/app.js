// Configuration
const REPO_OWNER = 'XavierKain';
const REPO_NAME = 'paraflightlog-wings';
const BRANCH = 'main';

// GitHub OAuth App - Device Flow
// Pour créer une OAuth App:
// 1. Aller sur https://github.com/settings/developers
// 2. Cliquer "New OAuth App"
// 3. Application name: "ParaFlightLog Wing Admin"
// 4. Homepage URL: https://xavierkain.github.io/paraflightlog-wings/admin/
// 5. Authorization callback URL: https://xavierkain.github.io/paraflightlog-wings/admin/
// 6. Cocher "Enable Device Flow"
// 7. Copier le Client ID ici:
const GITHUB_CLIENT_ID = 'Ov23lixuHuLOjz61wVOB';

// State
let catalog = null;
let githubToken = null;
let pendingDeleteId = null;
let pendingDeleteManufacturerId = null;
let deviceFlowInterval = null;

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
    // Reset modal state
    document.getElementById('token-input-section').style.display = 'block';
    document.getElementById('device-flow-section').style.display = 'none';
    document.getElementById('github-token').value = '';
    document.getElementById('login-modal').classList.add('show');
}

// OAuth Device Flow - Connexion avec compte GitHub
async function loginWithGitHub() {
    if (!GITHUB_CLIENT_ID) {
        alert('OAuth non configuré. Utilisez un Personal Access Token.');
        return;
    }

    try {
        // Step 1: Request device and user codes
        const codeResponse = await fetch('https://github.com/login/device/code', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                scope: 'repo'
            })
        });

        if (!codeResponse.ok) {
            throw new Error('Erreur lors de la demande de code');
        }

        const codeData = await codeResponse.json();

        // Show device flow UI
        document.getElementById('token-input-section').style.display = 'none';
        document.getElementById('device-flow-section').style.display = 'block';
        document.getElementById('device-user-code').textContent = codeData.user_code;
        document.getElementById('device-verify-link').href = codeData.verification_uri;
        document.getElementById('device-verify-link').textContent = codeData.verification_uri;

        // Copy code to clipboard
        try {
            await navigator.clipboard.writeText(codeData.user_code);
        } catch (e) {
            // Clipboard not available
        }

        // Step 2: Poll for access token
        const interval = codeData.interval || 5;
        deviceFlowInterval = setInterval(async () => {
            try {
                const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        client_id: GITHUB_CLIENT_ID,
                        device_code: codeData.device_code,
                        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
                    })
                });

                const tokenData = await tokenResponse.json();

                if (tokenData.access_token) {
                    clearInterval(deviceFlowInterval);
                    deviceFlowInterval = null;

                    githubToken = tokenData.access_token;
                    localStorage.setItem('github_token', githubToken);

                    // Validate and get username
                    const userResponse = await fetch('https://api.github.com/user', {
                        headers: { 'Authorization': `Bearer ${githubToken}` }
                    });

                    if (userResponse.ok) {
                        const user = await userResponse.json();
                        showLoggedIn(user.login);
                        closeModal('login-modal');
                    }
                } else if (tokenData.error === 'authorization_pending') {
                    // Still waiting, continue polling
                } else if (tokenData.error === 'slow_down') {
                    // Slow down polling
                } else if (tokenData.error === 'expired_token') {
                    clearInterval(deviceFlowInterval);
                    deviceFlowInterval = null;
                    alert('Code expiré. Veuillez réessayer.');
                    document.getElementById('token-input-section').style.display = 'block';
                    document.getElementById('device-flow-section').style.display = 'none';
                } else if (tokenData.error === 'access_denied') {
                    clearInterval(deviceFlowInterval);
                    deviceFlowInterval = null;
                    alert('Accès refusé.');
                    document.getElementById('token-input-section').style.display = 'block';
                    document.getElementById('device-flow-section').style.display = 'none';
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, interval * 1000);

    } catch (error) {
        alert('Erreur OAuth: ' + error.message);
        console.error('OAuth error:', error);
    }
}

function cancelDeviceFlow() {
    if (deviceFlowInterval) {
        clearInterval(deviceFlowInterval);
        deviceFlowInterval = null;
    }
    document.getElementById('token-input-section').style.display = 'block';
    document.getElementById('device-flow-section').style.display = 'none';
}

// Login with Personal Access Token
async function login() {
    const token = document.getElementById('github-token').value.trim();
    if (!token) return;

    githubToken = token;

    try {
        const response = await fetch('https://api.github.com/user', {
            headers: { 'Authorization': `Bearer ${token}` }
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
            headers: { 'Authorization': `Bearer ${githubToken}` }
        });

        if (response.ok) {
            const user = await response.json();
            showLoggedIn(user.login);
        } else {
            console.warn('Token invalide ou expiré, déconnexion...');
            logout();
        }
    } catch (error) {
        console.error('Erreur de validation du token:', error);
        logout();
    }
}

function showLoggedIn(username) {
    document.getElementById('login-btn').style.display = 'none';
    document.getElementById('user-info').style.display = 'flex';
    document.getElementById('username').textContent = username;
    document.getElementById('add-wing-btn').disabled = false;
    document.getElementById('manage-manufacturers-btn').disabled = false;
}

function logout() {
    githubToken = null;
    localStorage.removeItem('github_token');
    if (deviceFlowInterval) {
        clearInterval(deviceFlowInterval);
        deviceFlowInterval = null;
    }
    document.getElementById('login-btn').style.display = 'block';
    document.getElementById('user-info').style.display = 'none';
    document.getElementById('add-wing-btn').disabled = true;
    document.getElementById('manage-manufacturers-btn').disabled = true;
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
        // Utiliser un timestamp unique pour éviter le cache navigateur
        // Note: On ne peut pas utiliser Cache-Control headers avec CORS sur GitHub API
        const timestamp = Date.now();
        const response = await fetch(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${BRANCH}&_=${timestamp}`,
            {
                headers: {
                    'Authorization': `Bearer ${githubToken}`
                }
            }
        );

        if (response.ok) {
            const data = await response.json();
            return data.sha;
        }
    } catch {
        // File doesn't exist or error
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
            'Authorization': `Bearer ${githubToken}`,
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
            'Authorization': `Bearer ${githubToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: `Delete ${path}`,
            sha,
            branch: BRANCH
        })
    });
}

async function saveCatalog(retryCount = 0) {
    const maxRetries = 3;

    // Récupérer le SHA frais avec timestamp pour éviter le cache
    // Note: On ne peut pas utiliser Cache-Control headers avec CORS sur GitHub API
    const timestamp = Date.now();
    let sha = null;

    try {
        const shaResponse = await fetch(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/wings.json?ref=${BRANCH}&_=${timestamp}`,
            {
                headers: {
                    'Authorization': `Bearer ${githubToken}`
                }
            }
        );

        if (shaResponse.ok) {
            const data = await shaResponse.json();
            sha = data.sha;
            console.log(`Got fresh SHA: ${sha.substring(0, 7)}...`);
        } else if (shaResponse.status === 404) {
            console.log('File does not exist yet, will create new file');
            sha = null;
        } else {
            console.warn(`SHA fetch returned status ${shaResponse.status}`);
        }
    } catch (error) {
        console.warn('Error fetching SHA:', error);
    }

    const content = btoa(unescape(encodeURIComponent(JSON.stringify(catalog, null, 2))));

    const body = {
        message: 'Update wing catalog',
        content,
        branch: BRANCH
    };

    // Ajouter SHA seulement si le fichier existe déjà
    if (sha) {
        body.sha = sha;
    }

    console.log(`Saving catalog (attempt ${retryCount + 1}), SHA: ${sha ? sha.substring(0, 7) + '...' : 'none (new file)'}`);

    const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/wings.json`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.message || response.statusText;

        console.error(`Save failed (${response.status}): ${errorMsg}`);

        // Erreur 409 = conflit de SHA (fichier modifié entre-temps)
        // Erreur 422 = SHA invalide ou manquant
        if ((response.status === 409 || response.status === 422) && retryCount < maxRetries) {
            console.warn(`SHA conflict/invalid, retrying... (attempt ${retryCount + 1}/${maxRetries})`);
            // Attendre avec backoff exponentiel avant de réessayer
            const delay = 1000 * Math.pow(2, retryCount);
            await new Promise(resolve => setTimeout(resolve, delay));
            return saveCatalog(retryCount + 1);
        }

        throw new Error(`Failed to save catalog: ${errorMsg}`);
    }

    // Récupérer le nouveau SHA depuis la réponse pour les opérations suivantes
    const responseData = await response.json();
    console.log(`Catalog saved successfully, new SHA: ${responseData.content.sha.substring(0, 7)}...`);

    // Attendre un peu pour laisser GitHub propager le changement
    await new Promise(resolve => setTimeout(resolve, 500));
}

// ============================================
// Manufacturer Management Functions
// ============================================

function showManufacturersModal() {
    renderManufacturersList();
    document.getElementById('new-manufacturer-name').value = '';
    document.getElementById('new-manufacturer-id').value = '';
    document.getElementById('manufacturers-modal').classList.add('show');
}

function renderManufacturersList() {
    const container = document.getElementById('manufacturers-list');

    if (!catalog || !catalog.manufacturers.length) {
        container.innerHTML = '<p class="loading">Aucun fabricant</p>';
        return;
    }

    // Sort manufacturers by name
    const sortedManufacturers = [...catalog.manufacturers].sort((a, b) =>
        a.name.localeCompare(b.name)
    );

    container.innerHTML = sortedManufacturers.map(manufacturer => {
        const wingCount = catalog.wings.filter(w => w.manufacturer === manufacturer.id).length;
        return `
            <div class="manufacturer-item">
                <div class="manufacturer-info">
                    <span class="manufacturer-name">${manufacturer.name}</span>
                    <span class="manufacturer-id">${manufacturer.id}</span>
                    <span class="manufacturer-wing-count">${wingCount} voile${wingCount !== 1 ? 's' : ''}</span>
                </div>
                <div class="manufacturer-actions">
                    <button class="edit-btn" onclick="editManufacturer('${manufacturer.id}')">Modifier</button>
                    <button class="delete-btn" onclick="deleteManufacturer('${manufacturer.id}')">Supprimer</button>
                </div>
            </div>
        `;
    }).join('');
}

async function addManufacturer() {
    if (!githubToken) {
        alert('Veuillez vous connecter');
        return;
    }

    const name = document.getElementById('new-manufacturer-name').value.trim();
    let id = document.getElementById('new-manufacturer-id').value.trim().toLowerCase();

    if (!name) {
        alert('Veuillez entrer un nom de fabricant');
        return;
    }

    // Auto-generate ID if not provided
    if (!id) {
        id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }

    // Check for duplicate ID
    if (catalog.manufacturers.some(m => m.id === id)) {
        alert('Un fabricant avec cet ID existe déjà');
        return;
    }

    try {
        catalog.manufacturers.push({ id, name });
        catalog.lastUpdated = new Date().toISOString();

        await saveCatalog();

        document.getElementById('new-manufacturer-name').value = '';
        document.getElementById('new-manufacturer-id').value = '';
        renderManufacturersList();
        updateStats();

        alert('Fabricant ajouté !');
    } catch (error) {
        // Rollback
        catalog.manufacturers = catalog.manufacturers.filter(m => m.id !== id);
        alert('Erreur: ' + error.message);
        console.error('Add manufacturer error:', error);
    }
}

function editManufacturer(id) {
    const manufacturer = catalog.manufacturers.find(m => m.id === id);
    if (!manufacturer) return;

    document.getElementById('edit-manufacturer-old-id').value = id;
    document.getElementById('edit-manufacturer-name').value = manufacturer.name;
    document.getElementById('edit-manufacturer-id').value = manufacturer.id;

    document.getElementById('edit-manufacturer-modal').classList.add('show');
}

async function saveManufacturer(event) {
    event.preventDefault();

    if (!githubToken) {
        alert('Veuillez vous connecter');
        return;
    }

    const oldId = document.getElementById('edit-manufacturer-old-id').value;
    const newName = document.getElementById('edit-manufacturer-name').value.trim();
    const newId = document.getElementById('edit-manufacturer-id').value.trim().toLowerCase();

    if (!newName || !newId) {
        alert('Veuillez remplir tous les champs');
        return;
    }

    // Check for duplicate ID (excluding the current manufacturer)
    if (newId !== oldId && catalog.manufacturers.some(m => m.id === newId)) {
        alert('Un fabricant avec cet ID existe déjà');
        return;
    }

    try {
        // Update manufacturer
        const manufacturer = catalog.manufacturers.find(m => m.id === oldId);
        if (manufacturer) {
            manufacturer.name = newName;
            manufacturer.id = newId;
        }

        // Update wings if ID changed
        if (newId !== oldId) {
            catalog.wings.forEach(wing => {
                if (wing.manufacturer === oldId) {
                    wing.manufacturer = newId;
                    // Update fullName
                    wing.fullName = `${newName} ${wing.model}`;
                }
            });
        } else {
            // Just update fullName for name changes
            catalog.wings.forEach(wing => {
                if (wing.manufacturer === newId) {
                    wing.fullName = `${newName} ${wing.model}`;
                }
            });
        }

        catalog.lastUpdated = new Date().toISOString();

        await saveCatalog();

        closeModal('edit-manufacturer-modal');
        renderManufacturersList();
        renderCatalog();
        updateStats();

        alert('Fabricant modifié !');
    } catch (error) {
        alert('Erreur: ' + error.message);
        console.error('Save manufacturer error:', error);
        // Reload to restore state
        refreshCatalog();
    }
}

function deleteManufacturer(id) {
    const manufacturer = catalog.manufacturers.find(m => m.id === id);
    if (!manufacturer) return;

    const wingCount = catalog.wings.filter(w => w.manufacturer === id).length;

    pendingDeleteManufacturerId = id;
    document.getElementById('delete-manufacturer-name').textContent = manufacturer.name;

    const warningEl = document.getElementById('delete-manufacturer-warning');
    const deleteBtn = document.getElementById('confirm-delete-manufacturer-btn');

    if (wingCount > 0) {
        warningEl.textContent = `⚠️ Ce fabricant a ${wingCount} voile${wingCount > 1 ? 's' : ''} associée${wingCount > 1 ? 's' : ''}. Supprimez d'abord les voiles.`;
        deleteBtn.disabled = true;
    } else {
        warningEl.textContent = '';
        deleteBtn.disabled = false;
    }

    document.getElementById('delete-manufacturer-modal').classList.add('show');
}

async function confirmDeleteManufacturer() {
    if (!pendingDeleteManufacturerId || !githubToken) return;

    const wingCount = catalog.wings.filter(w => w.manufacturer === pendingDeleteManufacturerId).length;
    if (wingCount > 0) {
        alert('Impossible de supprimer un fabricant avec des voiles associées');
        return;
    }

    try {
        catalog.manufacturers = catalog.manufacturers.filter(m => m.id !== pendingDeleteManufacturerId);
        catalog.lastUpdated = new Date().toISOString();

        await saveCatalog();

        closeModal('delete-manufacturer-modal');
        pendingDeleteManufacturerId = null;
        renderManufacturersList();
        updateStats();

        alert('Fabricant supprimé !');
    } catch (error) {
        alert('Erreur: ' + error.message);
        console.error('Delete manufacturer error:', error);
        refreshCatalog();
    }
}
