let editModal = null;
let cancelModal = null;
let editIdInput = null;
let editNameInput = null;
let editBalanceInput = null;
let editExpirationInput = null;
let editDaysRemainingInput = null;
let editIndicationInput = null;
let cancelNameDisplay = null;
let currentUserId = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log('Verificando status de login...');
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn) {
        console.log('Usuário não está logado. Iniciando timer de 1 segundo para redirecionamento.');
        setTimeout(() => {
            console.log('Timer expirado. Redirecionando para login.html');
            window.location.href = '/login.html';
        }, 1000);
    } else {
        console.log('Usuário está logado. Acesso permitido.');
    }

    const tableBody = document.getElementById('usersTableBody');
    const totalUsersEl = document.getElementById('total-users');
    const totalBalanceEl = document.getElementById('total-balance');
    const activeSubscriptionsEl = document.getElementById('active-subscriptions');
    const expiredSubscriptionsEl = document.getElementById('expired-subscriptions');
    const sidebar = document.querySelector('.sidebar');
    const menuToggle = document.querySelector('.menu-toggle');
    const searchContainer = document.getElementById('search-container');
    const searchInput = document.getElementById('search-input');
    const usersTable = document.getElementById('usersTable');
    const logoutBtn = document.getElementById('logoutBtn');
    editModal = document.getElementById('editModal');
    cancelModal = document.getElementById('cancelModal');
    editIdInput = document.getElementById('edit-id');
    editNameInput = document.getElementById('edit-name');
    editBalanceInput = document.getElementById('edit-balance');
    editExpirationInput = document.getElementById('edit-expiration');
    editDaysRemainingInput = document.getElementById('edit-days-remaining');
    editIndicationInput = document.getElementById('edit-indication');
    cancelNameDisplay = document.getElementById('cancel-name');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    let allUsers = [];

    if (!tableBody || !totalUsersEl || !totalBalanceEl || !activeSubscriptionsEl || !expiredSubscriptionsEl || !sidebar || !menuToggle || !searchContainer || !searchInput || !usersTable || !logoutBtn || !editModal || !cancelModal || !editIdInput || !editNameInput || !editBalanceInput || !editExpirationInput || !editDaysRemainingInput || !editIndicationInput || !cancelNameDisplay || !loadingDiv || !errorDiv) {
        console.error('Erro: Um ou mais elementos DOM não foram encontrados:', {
            tableBody, totalUsersEl, totalBalanceEl, activeSubscriptionsEl, expiredSubscriptionsEl, sidebar, menuToggle, searchContainer, searchInput, usersTable, logoutBtn, editModal, cancelModal, editIdInput, editNameInput, editBalanceInput, editExpirationInput, editDaysRemainingInput, editIndicationInput, cancelNameDisplay, loadingDiv, errorDiv
        });
        return;
    }

    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        console.log('Menu toggle clicado, estado:', sidebar.classList.contains('active'));
    });

    const navLinks = document.querySelectorAll('.sidebar-nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            const action = link.textContent.trim();
            console.log('Navegação para:', action);
            if (action === 'Dashboard') {
                loadDashboard();
            } else if (action === 'Usuários') {
                loadUsers();
            } else if (action === 'Usuários Registrados') {
                loadRegisteredUsers();
            } else if (action === 'Usuários Ativos') {
                loadActiveUsers();
            } else if (action === 'Usuários Inativos') {
                loadInactiveUsers();
            } else if (link.id === 'logout') {
                handleLogout();
            }
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('active');
            }
        });
    });

    function loadDashboard() {
        console.log('Carregando Dashboard...');
        showLoading();
        searchContainer.style.display = 'none';
        usersTable.style.display = 'none';
        fetch('https://ghostdelay.discloud.app/users', {
            credentials: 'include',
            mode: 'cors'
        })
        .then(response => {
            console.log('Resposta do servidor para Dashboard:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            });
            if (!response.ok) {
                throw new Error(`Erro na requisição: ${response.status} - ${response.statusText}`);
            }
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                return response.text().then(text => {
                    throw new Error(`Resposta não é JSON: ${text.substring(0, 50)}...`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Dados brutos recebidos:', data);
            hideLoading();
            if (!data || !data.users || data.users.length === 0) {
                console.warn('Dados inválidos ou ausentes:', data);
                updateDashboardStats([]);
                showError('Nenhum dado disponível.');
                return;
            }
            allUsers = data.users;
            updateDashboardStats(data);
            console.log('Dashboard atualizado com:', data.users);
        })
        .catch(error => {
            hideLoading();
            console.error('Erro ao carregar Dashboard:', error);
            updateDashboardStats([]);
            showError(`Erro ao carregar dados: ${error.message}`);
            alert(`Erro ao carregar dados: ${error.message}`);
        });
    }

    function loadUsers() {
        console.log('Carregando Usuários...');
        showLoading();
        searchContainer.style.display = 'block';
        usersTable.style.display = 'table';
        fetch('https://ghostdelay.discloud.app/users', {
            credentials: 'include',
            mode: 'cors'
        })
        .then(response => {
            console.log('Resposta do servidor para Usuários:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            });
            if (!response.ok) {
                throw new Error(`Erro na requisição: ${response.status} - ${response.statusText}`);
            }
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                return response.text().then(text => {
                    throw new Error(`Resposta não é JSON: ${text.substring(0, 50)}...`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Dados brutos recebidos:', JSON.stringify(data, null, 2));
            hideLoading();
            if (!data || !data.users || data.users.length === 0) {
                console.warn('Nenhum usuário encontrado ou dados inválidos:', data);
                tableBody.innerHTML = '<tr><td colspan="9">Nenhum usuário encontrado.</td></tr>';
                updateDashboardStats(data);
                return;
            }
            allUsers = data.users;
            updateDashboardStats(data);
            populateUserTable(data.users);
            console.log('Usuários carregados:', data.users);
        })
        .catch(error => {
            hideLoading();
            console.error('Erro ao carregar Usuários:', error);
            tableBody.innerHTML = `<tr><td colspan="9">Erro: ${error.message}</td></tr>`;
            updateDashboardStats([]);
            showError(`Erro ao carregar usuários: ${error.message}`);
            alert(`Erro ao carregar usuários: ${error.message}`);
        });
    }

    function loadRegisteredUsers() {
        console.log('Carregando Usuários Registrados...');
        showLoading();
        searchContainer.style.display = 'block';
        usersTable.style.display = 'table';
        fetch('https://ghostdelay.discloud.app/users', {
            credentials: 'include',
            mode: 'cors'
        })
        .then(response => {
            console.log('Resposta do servidor para Usuários Registrados:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            });
            if (!response.ok) {
                throw new Error(`Erro na requisição: ${response.status} - ${response.statusText}`);
            }
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                return response.text().then(text => {
                    throw new Error(`Resposta não é JSON: ${text.substring(0, 50)}...`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Dados brutos recebidos:', data);
            hideLoading();
            if (!data || !data.users || data.users.length === 0) {
                console.warn('Nenhum usuário encontrado ou dados inválidos:', data);
                tableBody.innerHTML = '<tr><td colspan="9">Nenhum usuário registrado encontrado.</td></tr>';
                updateDashboardStats(data);
                return;
            }
            allUsers = data.users;
            const registeredUsers = data.users.filter(user => {
                const hasNoPaymentHistory = !user.paymentHistory || user.paymentHistory.length === 0;
                const hasNoExpiration = !user.expirationDate;
                return hasNoPaymentHistory && hasNoExpiration;
            });
            if (registeredUsers.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="9">Nenhum usuário registrado encontrado.</td></tr>';
            } else {
                populateUserTable(registeredUsers);
            }
            updateDashboardStats(data);
            console.log('Usuários registrados carregados:', registeredUsers);
        })
        .catch(error => {
            hideLoading();
            console.error('Erro ao carregar dados:', error);
            tableBody.innerHTML = `<tr><td colspan="9">Erro: ${error.message}</td></tr>`;
            updateDashboardStats([]);
            showError(`Erro ao carregar usuários registrados: ${error.message}`);
            alert(`Erro ao carregar usuários registrados: ${error.message}`);
        });
    }

    function loadActiveUsers() {
        console.log('Carregando Usuários Ativos...');
        showLoading();
        searchContainer.style.display = 'block';
        usersTable.style.display = 'table';
        fetch('https://ghostdelay.discloud.app/users', {
            credentials: 'include',
            mode: 'cors'
        })
        .then(response => {
            console.log('Resposta do servidor para Usuários Ativos:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            });
            if (!response.ok) {
                throw new Error(`Erro na requisição: ${response.status} - ${response.statusText}`);
            }
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                return response.text().then(text => {
                    throw new Error(`Resposta não é JSON: ${text.substring(0, 50)}...`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Dados brutos recebidos:', data);
            hideLoading();
            if (!data || !data.users || data.users.length === 0) {
                console.warn('Nenhum usuário encontrado ou dados inválidos:', data);
                tableBody.innerHTML = '<tr><td colspan="9">Nenhum usuário ativo encontrado.</td></tr>';
                updateDashboardStats(data);
                return;
            }
            allUsers = data.users;
            const activeUsers = data.users.filter(user => {
                if (!user.expirationDate) return false;
                const expDate = new Date(user.expirationDate);
                return !isNaN(expDate.getTime()) && expDate > new Date();
            });
            if (activeUsers.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="9">Nenhum usuário ativo encontrado.</td></tr>';
            } else {
                populateUserTable(activeUsers);
            }
            updateDashboardStats(data);
            console.log('Usuários ativos carregados:', activeUsers);
        })
        .catch(error => {
            hideLoading();
            console.error('Erro ao carregar dados:', error);
            tableBody.innerHTML = `<tr><td colspan="9">Erro: ${error.message}</td></tr>`;
            updateDashboardStats([]);
            showError(`Erro ao carregar usuários ativos: ${error.message}`);
            alert(`Erro ao carregar usuários ativos: ${error.message}`);
        });
    }

    function loadInactiveUsers() {
        console.log('Carregando Usuários Inativos...');
        showLoading();
        searchContainer.style.display = 'block';
        usersTable.style.display = 'table';
        fetch('https://ghostdelay.discloud.app/users', {
            credentials: 'include',
            mode: 'cors'
        })
        .then(response => {
            console.log('Resposta do servidor para Usuários Inativos:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            });
            if (!response.ok) {
                throw new Error(`Erro na requisição: ${response.status} - ${response.statusText}`);
            }
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                return response.text().then(text => {
                    throw new Error(`Resposta não é JSON: ${text.substring(0, 50)}...`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Dados brutos recebidos:', data);
            hideLoading();
            if (!data || !data.users || data.users.length === 0) {
                console.warn('Nenhum usuário encontrado ou dados inválidos:', data);
                tableBody.innerHTML = '<tr><td colspan="9">Nenhum usuário inativo encontrado.</td></tr>';
                updateDashboardStats(data);
                return;
            }
            allUsers = data.users;
            const inactiveUsers = data.users.filter(user => {
                if (!user.expirationDate) return true;
                const expDate = new Date(user.expirationDate);
                return isNaN(expDate.getTime()) || expDate <= new Date();
            });
            if (inactiveUsers.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="9">Nenhum usuário inativo encontrado.</td></tr>';
            } else {
                populateUserTable(inactiveUsers);
            }
            updateDashboardStats(data);
            console.log('Usuários inativos carregados:', inactiveUsers);
        })
        .catch(error => {
            hideLoading();
            console.error('Erro ao carregar dados:', error);
            tableBody.innerHTML = `<tr><td colspan="9">Erro: ${error.message}</td></tr>`;
            updateDashboardStats([]);
            showError(`Erro ao carregar usuários inativos: ${error.message}`);
            alert(`Erro ao carregar usuários inativos: ${error.message}`);
        });
    }

    function updateDashboardStats(data) {
        console.log('Atualizando estatísticas do Dashboard:', data);
        const users = data.users || [];
        const totalUsers = users.length;
        const totalBalance = data.totalBalanceFromHistory || '0.00';
        let activeSubscriptions = 0;
        let expiredSubscriptions = 0;

        users.forEach(user => {
            const expDate = user.expirationDate ? new Date(user.expirationDate) : null;
            if (expDate && !isNaN(expDate.getTime()) && expDate > new Date()) {
                activeSubscriptions++;
            } else {
                expiredSubscriptions++;
            }
        });

        totalUsersEl.textContent = totalUsers;
        totalBalanceEl.textContent = parseFloat(totalBalance).toFixed(2);
        activeSubscriptionsEl.textContent = activeSubscriptions;
        expiredSubscriptionsEl.textContent = expiredSubscriptions;

        console.log('Estatísticas atualizadas:', {
            totalUsers,
            totalBalance: parseFloat(totalBalance).toFixed(2),
            activeSubscriptions,
            expiredSubscriptions
        });
    }

    function populateUserTable(users) {
        console.log('Populando tabela com usuários:', users);
        tableBody.innerHTML = '';
        const indicationCoupons = ['SOUZASETE', 'MT', 'RNUNES', 'DG', 'GREENZADA', 'BLACKGG', 'COQUIN7', 'NIKGREEN', 'THCARRILLO', 'GOMESCITY', 'ITZGOD'];
    
        users.forEach(user => {
            const paymentDates = user.paymentHistory && user.paymentHistory.length > 0
                ? user.paymentHistory.map(p => new Date(p.timestamp).toLocaleDateString('pt-BR')).join(', ')
                : '-';
            const escapedName = user.name ? user.name.replace(/'/g, "\\'") : '-';
            const indication = user.indication || 'Nenhuma';
            const row = document.createElement('tr');
            if (indicationCoupons.includes(indication)) {
                row.classList.add('indicated-user');
            }
            const expirationDate = user.expirationDate ? new Date(user.expirationDate) : null;
            const daysRemaining = calculateDaysRemaining(user.expirationDate);
            const formattedExpiration = expirationDate && !isNaN(expirationDate.getTime())
                ? expirationDate.toLocaleDateString('pt-BR')
                : '-';
    
            row.innerHTML = `
                <td>${user.userId || '-'}</td>
                <td>${user.name || '-'}</td>
                <td>${user.whatsapp || '-'}</td>
                <td>${user.registeredAt ? new Date(user.registeredAt).toLocaleDateString('pt-BR') : '-'}</td>
                <td>${paymentDates}</td>
                <td>${(user.balance || 0).toFixed(2)}</td>
                <td>${formattedExpiration}</td>
                <td>${daysRemaining}</td>
                <td>
                    <button class="action-btn edit-btn" data-user-id="${user.userId}" data-name="${escapedName}" data-balance="${user.balance || 0}" data-expiration="${user.expirationDate || ''}" data-indication="${indication}">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="action-btn delete-btn" data-user-id="${user.userId}" data-name="${escapedName}">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
        console.log('Tabela populada com sucesso');
    }

    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        console.log('Busca iniciada com termo:', searchTerm);
        const filteredUsers = allUsers.filter(user => {
            return (user.userId && user.userId.toLowerCase().includes(searchTerm)) ||
                   (user.name && user.name.toLowerCase().includes(searchTerm));
        });
        populateUserTable(filteredUsers);
        console.log('Tabela filtrada com:', filteredUsers);
    });

    const saveChangesBtn = document.querySelector('#editModal .save-btn');
    if (saveChangesBtn) {
        saveChangesBtn.addEventListener('click', () => {
            console.log('Botão "Salvar Alterações" clicado para userId:', currentUserId);
            if (!currentUserId) {
                console.error('Erro: currentUserId não definido');
                alert('Erro: ID do usuário não encontrado.');
                return;
            }
            const name = editNameInput.value;
            const balance = parseFloat(editBalanceInput.value) || 0;
            const expirationDate = editExpirationInput.value || null;
            const indication = editIndicationInput.value === 'Nenhuma' ? null : editIndicationInput.value;

            const requestBody = { name, balance, expirationDate, indication };

            console.log('Enviando requisição PUT com:', requestBody);
            fetch(`https://ghostdelay.discloud.app/user/${currentUserId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                mode: 'cors',
                body: JSON.stringify(requestBody)
            })
            .then(response => {
                console.log('Resposta do servidor ao salvar:', {
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries())
                });
                if (!response.ok) {
                    return response.text().then(text => {
                        throw new Error(`Erro: ${response.status} - ${text || response.statusText}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                console.log('Dados retornados após salvar:', JSON.stringify(data, null, 2));
                if (data.error) throw new Error(data.error);
                alert('Sucesso: Dados atualizados!');
                $(editModal).modal('hide');
                loadUsers();
            })
            .catch(error => {
                console.error('Erro ao salvar:', error);
                alert(`Erro ao atualizar dados: ${error.message}`);
            });
        });
    } else {
        console.error('Erro: Botão "Salvar Alterações" não encontrado');
    }

    $(editModal).on('hidden.bs.modal', () => {
        currentUserId = null;
        console.log('Modal de edição fechado');
    });

    $(cancelModal).on('hidden.bs.modal', () => {
        currentUserId = null;
        console.log('Modal de cancelamento fechado');
    });

    function showLoading() {
        loadingDiv.style.display = 'block';
        errorDiv.style.display = 'none';
        console.log('Exibindo estado de carregamento');
    }

    function hideLoading() {
        loadingDiv.style.display = 'none';
        console.log('Ocultando estado de carregamento');
    }

    function showError(message) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        console.log('Erro exibido:', message);
    }

    function handleLogout() {
        console.log('Logout solicitado');
        fetch('https://ghostdelay.discloud.app/logout', {
            method: 'POST',
            credentials: 'include',
            mode: 'cors'
        })
        .then(response => {
            console.log('Resposta do logout:', { status: response.status, statusText: response.statusText });
            return response.json().catch(() => ({}));
        })
        .then(data => {
            console.log('Dados do logout:', data);
        })
        .catch(error => {
            console.error('Erro ao fazer logout:', error.message);
        })
        .finally(() => {
            localStorage.removeItem('isLoggedIn');
            console.log('isLoggedIn removido do localStorage');
            window.location.href = '/login.html';
        });
    }

    logoutBtn.addEventListener('click', handleLogout);

    tableBody.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.edit-btn');
        const deleteBtn = e.target.closest('.delete-btn');

        if (editBtn) {
            const userId = editBtn.dataset.userId;
            const name = editBtn.dataset.name.replace(/\\'/g, "'");
            const balance = parseFloat(editBtn.dataset.balance) || 0;
            const expirationDate = editBtn.dataset.expiration;
            const indication = editBtn.dataset.indication || '';
            console.log('Clicou em Editar para userId:', userId);
            window.openEditModal(userId, name, balance, expirationDate, indication);
        } else if (deleteBtn) {
            const userId = deleteBtn.dataset.userId;
            const name = deleteBtn.dataset.name.replace(/\\'/g, "'");
            console.log('Clicou em Excluir para userId:', userId);
            window.openCancelModal(userId, name);
        }
    });

    window.openEditModal = function(userId, name, balance, expirationDate, indication) {
        console.log('Abrindo modal de edição:', { userId, name, balance, expirationDate, indication });
        if (!editModal || !editIdInput || !editNameInput || !editBalanceInput || !editExpirationInput || !editDaysRemainingInput || !editIndicationInput) {
            console.error('Erro: Alguns elementos do modal de edição não foram encontrados');
            return;
        }
        currentUserId = userId;
        editIdInput.value = userId || '-';
        editNameInput.value = name || '-';
        editBalanceInput.value = balance.toFixed(2);
        
        if (expirationDate) {
            try {
                const expDate = new Date(expirationDate);
                if (isNaN(expDate.getTime())) {
                    console.warn('Data de expiração inválida ao abrir modal:', expirationDate);
                    editExpirationInput.value = '';
                    editDaysRemainingInput.value = '0 dias';
                } else {
                    editExpirationInput.value = expDate.toISOString().split('T')[0];
                    updateDaysRemaining(expDate);
                }
            } catch (err) {
                console.error('Erro ao parsear expirationDate no modal:', err.message, { expirationDate });
                editExpirationInput.value = '';
                editDaysRemainingInput.value = '0 dias';
            }
        } else {
            editExpirationInput.value = '';
            editDaysRemainingInput.value = '0 dias';
        }

        editIndicationInput.value = indication || 'Nenhuma';
        console.log('Valor de Indicação definido:', editIndicationInput.value);

        $(editModal).modal('show');
        console.log('Modal de edição exibido');
    };

    function updateDaysRemaining(expirationDate) {
        if (!editDaysRemainingInput) {
            console.error('Erro: editDaysRemainingInput não encontrado');
            return;
        }
        const currentDate = new Date();
        const diffTime = new Date(expirationDate) - currentDate;
        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        editDaysRemainingInput.value = daysRemaining > 0 ? `${daysRemaining} dias` : '0 dias';
        console.log('Dias restantes calculados:', editDaysRemainingInput.value);
    }

    function calculateDaysRemaining(expirationDate) {
        if (!expirationDate) return '0 dias';
        try {
            const expDate = new Date(expirationDate);
            if (isNaN(expDate.getTime())) {
                console.warn('Data de expiração inválida na tabela:', expirationDate);
                return '0 dias';
            }
            const currentDate = new Date();
            const diffTime = expDate - currentDate;
            const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return daysRemaining > 0 ? `${daysRemaining} dias` : '0 dias';
        } catch (err) {
            console.error('Erro ao calcular dias restantes na tabela:', err.message, { expirationDate });
            return '0 dias';
        }
    }

    window.openCancelModal = function(userId, name) {
        console.log('Abrindo modal de cancelamento:', { userId, name });
        if (!cancelModal || !cancelNameDisplay) {
            console.error('Erro: Elementos do modal de cancelamento não foram encontrados');
            return;
        }
        currentUserId = userId;
        cancelNameDisplay.textContent = name || '-';
        $(cancelModal).modal('show');
        console.log('Modal de cancelamento exibido');

        const cancelSubscriptionBtn = document.querySelector('#cancelModal .delete-btn');
        if (cancelSubscriptionBtn) {
            cancelSubscriptionBtn.removeEventListener('click', handleCancelSubscription); // Remover evento anterior
            cancelSubscriptionBtn.addEventListener('click', handleCancelSubscription, { once: true });
            console.log('Evento de clique associado ao botão "Cancelar Assinatura"');
        } else {
            console.error('Erro: Botão "Cancelar Assinatura" não encontrado');
        }

        const deleteAllBtn = document.querySelector('#cancelModal .delete-all-btn');
        if (deleteAllBtn) {
            deleteAllBtn.removeEventListener('click', handleDeleteAll); // Remover evento anterior
            deleteAllBtn.addEventListener('click', handleDeleteAll, { once: true });
            console.log('Evento de clique associado ao botão "Excluir Todos os Dados"');
        } else {
            console.error('Erro: Botão "Excluir Todos os Dados" não encontrado');
        }
    };

    function handleCancelSubscription() {
        console.log('Botão "Cancelar Assinatura" clicado para userId:', currentUserId);
        if (!currentUserId) {
            console.error('Erro: currentUserId não definido');
            alert('Erro: ID do usuário não encontrado.');
            return;
        }
        fetch(`https://ghostdelay.discloud.app/user/${currentUserId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            mode: 'cors'
        })
        .then(response => {
            console.log('Resposta bruta:', { status: response.status, statusText: response.statusText, headers: Object.fromEntries(response.headers.entries()) });
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`Erro: ${response.status} - ${text || response.statusText}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Resposta do servidor:', data);
            alert('Sucesso: Assinatura cancelada com sucesso!');
            $(cancelModal).modal('hide');
            loadUsers();
        })
        .catch(error => {
            console.error('Erro ao cancelar assinatura:', error.message, error.stack);
            alert(`Erro ao cancelar assinatura: ${error.message}`);
        });
    }

    function handleDeleteAll() {
        console.log('Botão "Excluir Todos os Dados" clicado para userId:', currentUserId);
        if (!currentUserId) {
            console.error('Erro: currentUserId não definido');
            alert('Erro: ID do usuário não encontrado.');
            return;
        }
        if (!confirm('Tem certeza que deseja excluir TODOS os dados deste usuário? Esta ação não pode ser desfeita.')) {
            console.log('Exclusão cancelada pelo usuário');
            return;
        }
        fetch(`https://ghostdelay.discloud.app/user/${currentUserId}/all`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            mode: 'cors'
        })
        .then(response => {
            console.log('Resposta bruta:', { status: response.status, statusText: response.statusText, headers: Object.fromEntries(response.headers.entries()) });
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`Erro: ${response.status} - ${text || response.statusText}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Resposta do servidor:', data);
            alert('Sucesso: Todos os dados do usuário foram excluídos com sucesso!');
            $(cancelModal).modal('hide');
            loadUsers();
        })
        .catch(error => {
            console.error('Erro ao excluir todos os dados:', error.message, error.stack);
            alert(`Erro ao excluir todos os dados: ${error.message}`);
        });
    }

    loadUsers();
});