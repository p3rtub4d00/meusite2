document.addEventListener('DOMContentLoaded', () => {
    // --- VARIÁVEIS GLOBAIS E ESTADO DA APLICAÇÃO ---
    const DB = {
        products: [],
        sales: [],
        expenses: [],
        receivables: [],
        settings: {
            company: {
                name: "CONTEINER BEER",
                address: "",
                phone: "",
                email: ""
            },
            sales: {
                defaultPaymentMethod: "Dinheiro",
                taxPercentage: 0,
                enableStockControl: true,
                enableLowStockAlert: true
            },
            notifications: {
                notifyLowStock: true,
                notifyOverdue: true,
                notifyDailySales: true,
                notificationSound: "default"
            },
            backup: {
                frequency: 30,
                notifyOnBackup: true
            }
        },
        users: [
            { username: "admin", password: "admin", name: "Administrador", role: "admin" }
        ],
        notifications: []
    };

    let currentUser = null;
    let backupInterval = null;
    let salesChart = null;
    let productsChart = null;

    // --- ELEMENTOS DO DOM ---
    const elements = {
        // Telas
        loginScreen: document.getElementById('loginScreen'),
        mainSystem: document.getElementById('mainSystem'),
        
        // Login
        loginForm: document.getElementById('loginForm'),
        username: document.getElementById('username'),
        password: document.getElementById('password'),
        
        // Sidebar e Navegação
        sidebar: document.querySelector('.sidebar'),
        sidebarToggle: document.getElementById('sidebarToggle'),
        navLinks: document.querySelectorAll('.nav-link'),
        pageTitle: document.getElementById('pageTitle'),
        userName: document.getElementById('userName'),
        logoutBtn: document.getElementById('logoutBtn'),
        
        // Header
        themeToggle: document.getElementById('themeToggle'),
        notificationsBtn: document.getElementById('notificationsBtn'),
        notificationCount: document.getElementById('notificationCount'),
        notificationsPanel: document.getElementById('notificationsPanel'),
        notificationsList: document.getElementById('notificationsList'),
        clearNotificationsBtn: document.getElementById('clearNotificationsBtn'),
        quickSaleBtn: document.getElementById('quickSaleBtn'),
        
        // Dashboard
        todayRevenue: document.getElementById('todayRevenue'),
        salesCount: document.getElementById('salesCount'),
        stockValue: document.getElementById('stockValue'),
        stockItems: document.getElementById('stockItems'),
        receivablesValue: document.getElementById('receivablesValue'),
        receivablesCount: document.getElementById('receivablesCount'),
        lowStockCount: document.getElementById('lowStockCount'),
        lowStockItems: document.getElementById('lowStockItems'),
        monthExpenses: document.getElementById('monthExpenses'),
        dailyAverage: document.getElementById('dailyAverage'),
        highestExpense: document.getElementById('highestExpense'),
        clearSalesBtn: document.getElementById('clearSalesBtn'),
        recentSalesTable: document.getElementById('recentSalesTable') ? document.getElementById('recentSalesTable').querySelector('tbody') : null,
        chartRange: document.getElementById('chartRange'),
        
        // Tabelas
        productsTable: document.getElementById('productsTable'),
        salesTable: document.getElementById('salesTable'),
        expensesTable: document.getElementById('expensesTable'),
        receivablesTable: document.getElementById('receivablesTable'),
        
        // Modal
        modalContainer: document.getElementById('appModal'),
        modalTitle: document.getElementById('modalTitle'),
        modalBody: document.getElementById('modalBody'),
        modalSaveBtn: document.getElementById('modalSaveBtn'),
        modalCancelBtn: document.getElementById('modalCancelBtn'),
        modalCloseBtn: document.getElementById('modalCloseBtn'),
        
        // Loading
        loadingOverlay: document.getElementById('loadingOverlay'),
        
        // Backup
        lastBackup: document.getElementById('lastBackup'),
        nextBackup: document.getElementById('nextBackup'),
        dataSize: document.getElementById('dataSize'),
        backupNowBtn: document.getElementById('backupNowBtn'),
        restoreBackupBtn: document.getElementById('restoreBackupBtn'),
        downloadBackupBtn: document.getElementById('downloadBackupBtn'),
        backupFrequency: document.getElementById('backupFrequency'),
        backupNotifications: document.getElementById('backupNotifications'),
        
        // Configurações
        settingsTabs: document.querySelectorAll('.tab-btn'),
        companySettingsForm: document.getElementById('companySettingsForm'),
        salesSettingsForm: document.getElementById('salesSettingsForm'),
        notificationsSettingsForm: document.getElementById('notificationsSettingsForm'),
        addUserBtn: document.getElementById('addUserBtn')
    };

    let onSaveCallback = null;
    let currentModalData = null;

    // --- FUNÇÕES UTILITÁRIAS ---
    const parseFormattedNumber = (value) => {
        if (typeof value !== 'string' || value.trim() === '') return 0;
        return parseFloat(value.replace(/\./g, '').replace(',', '.'));
    };

    const formatCurrency = (value) => {
        if (typeof value !== 'number') value = 0;
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    };

    const formatDateTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('pt-BR');
    };

    const getTodayDate = () => new Date().toISOString().slice(0, 10);

    const showLoading = () => {
        elements.loadingOverlay.classList.remove('hidden');
    };

    const hideLoading = () => {
        setTimeout(() => {
            elements.loadingOverlay.classList.add('hidden');
        }, 300);
    };

    const showNotification = (title, message, type = 'info') => {
        const notification = {
            id: Date.now(),
            title,
            message,
            type,
            timestamp: new Date(),
            read: false
        };
        
        DB.notifications.unshift(notification);
        updateNotificationsUI();
        saveDB();
        
        if (DB.settings.notifications.notificationSound !== 'none') {
            playNotificationSound();
        }
    };

    const playNotificationSound = () => {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF5fdJivrJBhNjVgodDbq2EcBSt5r9rJfUj/AE6Yx9KdZEj/AFyf0sWQY1D/AGWl2LqJZ1j/AHCs3rOCZ2D/AHu047CBaGj/AIa56Kp/aHD/AJDD7qd+aXj/AJfJ9KZ+anj/AKDP+6V+a3z/AKfU/6R+bID/ALHZBKJ+bYD/ALjeB6B+boD/AMThDJ5+b4D/AMvkEZ1+cID/ANHnF5t+cYD/ANjqHJp+coD/ANztH5h+c4D/AODwI5Z+dID/AOPzJpR+dYD/AOb2KZJ+doD/AOz5LJB+d4D/APD8Lo5+eID/APQAMYx+eYD/APcCNIp9eoD/APoEOYh9e4D/AP0GPIZ9fID/AP8I');
        audio.volume = 0.3;
        audio.play().catch(() => {});
    };

    const updateNotificationsUI = () => {
        const unreadCount = DB.notifications.filter(n => !n.read).length;
        
        if (unreadCount > 0) {
            elements.notificationCount.textContent = unreadCount;
            elements.notificationCount.classList.remove('hidden');
        } else {
            elements.notificationCount.classList.add('hidden');
        }
        
        if (elements.notificationsList) {
            elements.notificationsList.innerHTML = '';
            DB.notifications.slice(0, 10).forEach(notification => {
                const notificationEl = document.createElement('div');
                notificationEl.className = `notification-item ${notification.read ? '' : 'unread'}`;
                notificationEl.innerHTML = `
                    <div class="notification-icon">
                        <i class="fas fa-${getNotificationIcon(notification.type)}"></i>
                    </div>
                    <div class="notification-content">
                        <div class="notification-title">${notification.title}</div>
                        <div class="notification-message">${notification.message}</div>
                        <div class="notification-time">${formatDateTime(notification.timestamp)}</div>
                    </div>
                `;
                
                notificationEl.addEventListener('click', () => {
                    notification.read = true;
                    updateNotificationsUI();
                    saveDB();
                });
                
                elements.notificationsList.appendChild(notificationEl);
            });
        }
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'success': return 'check-circle';
            case 'warning': return 'exclamation-triangle';
            case 'error': return 'exclamation-circle';
            default: return 'info-circle';
        }
    };

    const markAllNotificationsAsRead = () => {
        DB.notifications.forEach(notification => {
            notification.read = true;
        });
        updateNotificationsUI();
        saveDB();
    };

    // --- PERSISTÊNCIA DE DADOS ---
    const saveDB = () => {
        localStorage.setItem('conteinerBeerDB', JSON.stringify(DB));
        localStorage.setItem('conteinerBeerDB_lastUpdate', new Date().toISOString());
        updateDataSize();
    };

    const loadDB = () => {
        const data = JSON.parse(localStorage.getItem('conteinerBeerDB'));
        if (data) {
            Object.keys(DB).forEach(key => {
                if (data[key] !== undefined) {
                    if (key === 'settings' && data[key]) {
                        Object.keys(DB.settings).forEach(settingKey => {
                            if (data.settings[settingKey]) {
                                DB.settings[settingKey] = { 
                                    ...DB.settings[settingKey], 
                                    ...data.settings[settingKey] 
                                };
                            }
                        });
                    } else {
                        DB[key] = data[key];
                    }
                }
            });
        }
        updateDataSize();
    };

    const updateDataSize = () => {
        const data = JSON.stringify(DB);
        const sizeInKB = (new Blob([data]).size / 1024).toFixed(2);
        if (elements.dataSize) {
            elements.dataSize.textContent = `${sizeInKB} KB`;
        }
    };

    // --- SISTEMA DE BACKUP ---
    const setupBackupSystem = () => {
        const frequency = DB.settings.backup.frequency;
        setupBackupInterval(frequency);
        updateBackupUI();
    };

    const setupBackupInterval = (minutes) => {
        if (backupInterval) {
            clearInterval(backupInterval);
        }
        backupInterval = setInterval(createBackup, minutes * 60 * 1000);
        updateNextBackupTime(minutes);
    };

    const createBackup = () => {
        localStorage.setItem('conteinerBeerDB_backup', JSON.stringify(DB));
        localStorage.setItem('conteinerBeerDB_backupTime', new Date().toISOString());
        updateBackupUI();
        if (DB.settings.backup.notifyOnBackup) {
            showNotification('Backup Realizado', 'Backup dos dados realizado com sucesso.', 'success');
        }
        console.log('Backup automático realizado:', new Date().toLocaleString('pt-BR'));
    };

    const restoreBackup = () => {
        if (confirm('Tem certeza que deseja restaurar o último backup? Os dados atuais serão substituídos.')) {
            const backupData = JSON.parse(localStorage.getItem('conteinerBeerDB_backup'));
            if (backupData) {
                Object.keys(DB).forEach(key => {
                    if (backupData[key] !== undefined) {
                        DB[key] = backupData[key];
                    }
                });
                saveDB();
                renderAll();
                showNotification('Backup Restaurado', 'Dados restaurados do backup com sucesso.', 'success');
            } else {
                alert('Nenhum backup encontrado para restaurar.');
            }
        }
    };

    const downloadBackup = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(DB));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `conteinerbeer_backup_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        showNotification('Download de Backup', 'Download do arquivo de backup realizado com sucesso.', 'success');
    };

    const updateBackupUI = () => {
        const backupTime = localStorage.getItem('conteinerBeerDB_backupTime');
        if (backupTime && elements.lastBackup) {
            elements.lastBackup.textContent = new Date(backupTime).toLocaleString('pt-BR');
        }
    };

    const updateNextBackupTime = (minutes) => {
        const nextBackup = new Date(Date.now() + minutes * 60 * 1000);
        if (elements.nextBackup) {
            elements.nextBackup.textContent = nextBackup.toLocaleTimeString('pt-BR');
        }
    };

    // --- SISTEMA DE LOGIN E SEGURANÇA ---
    const setupLoginSystem = () => {
        const savedUser = localStorage.getItem('conteinerBeer_currentUser');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            showMainSystem();
        } else {
            showLoginScreen();
        }
    };

    const showLoginScreen = () => {
        if (elements.loginScreen) elements.loginScreen.classList.remove('hidden');
        if (elements.mainSystem) elements.mainSystem.classList.add('hidden');
    };

    const showMainSystem = () => {
        if (elements.loginScreen) elements.loginScreen.classList.add('hidden');
        if (elements.mainSystem) elements.mainSystem.classList.remove('hidden');
        if (elements.userName) elements.userName.textContent = currentUser.name;
        initializeMainSystem();
    };

    const login = (username, password) => {
        const user = DB.users.find(u => u.username === username && u.password === password);
        if (user) {
            currentUser = user;
            localStorage.setItem('conteinerBeer_currentUser', JSON.stringify(user));
            showMainSystem();
            return true;
        }
        return false;
    };

    const logout = () => {
        currentUser = null;
        localStorage.removeItem('conteinerBeer_currentUser');
        showLoginScreen();
    };

    // --- SISTEMA PRINCIPAL ---
    const initializeMainSystem = () => {
        loadDB();
        setupBackupSystem();
        setupEventListeners();
        renderAll();
        setupCharts();
        checkInitialNotifications();
    };

    const checkInitialNotifications = () => {
        const lowStockItems = DB.products.filter(p => p.quantity <= p.lowStockThreshold);
        if (lowStockItems.length > 0 && DB.settings.notifications.notifyLowStock) {
            showNotification('Estoque Baixo', `${lowStockItems.length} produtos com estoque baixo.`, 'warning');
        }
        
        const today = new Date();
        const overdueReceivables = DB.receivables.filter(r => {
            if (r.status === 'Pendente') {
                const dueDate = new Date(r.dueDate);
                return dueDate < today;
            }
            return false;
        });
        
        if (overdueReceivables.length > 0 && DB.settings.notifications.notifyOverdue) {
            showNotification('Contas Vencidas', `${overdueReceivables.length} contas vencidas.`, 'error');
        }
    };

    const setupEventListeners = () => {
        // O listener do formulário de login foi MOVIDO para a função init()

        // Logout
        if (elements.logoutBtn) {
            elements.logoutBtn.addEventListener('click', logout);
        }
        
        // Sidebar toggle
        if (elements.sidebarToggle) {
            elements.sidebarToggle.addEventListener('click', () => {
                elements.sidebar.classList.toggle('collapsed');
            });
        }
        
        // Navegação
        if (elements.navLinks) {
            elements.navLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    elements.navLinks.forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                    
                    const target = link.dataset.target;
                    document.querySelectorAll('.content-section').forEach(section => {
                        section.classList.remove('active');
                    });
                    document.getElementById(target).classList.add('active');
                    
                    if (elements.pageTitle) {
                        elements.pageTitle.textContent = link.querySelector('span').textContent;
                    }
                    
                    if (elements.notificationsPanel) {
                        elements.notificationsPanel.classList.add('hidden');
                    }
                });
            });
        }
        
        // Toggle de tema
        if (elements.themeToggle) {
            elements.themeToggle.addEventListener('click', () => {
                document.body.classList.toggle('light-theme');
                const isLightTheme = document.body.classList.contains('light-theme');
                elements.themeToggle.innerHTML = isLightTheme ? 
                    '<i class="fas fa-sun"></i>' : 
                    '<i class="fas fa-moon"></i>';
                localStorage.setItem('conteinerBeer_theme', isLightTheme ? 'light' : 'dark');
            });
        }
        
        // Notificações
        if (elements.notificationsBtn) {
            elements.notificationsBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                elements.notificationsPanel.classList.toggle('hidden');
            });
        }
        
        if (elements.clearNotificationsBtn) {
            elements.clearNotificationsBtn.addEventListener('click', markAllNotificationsAsRead);
        }
        
        document.addEventListener('click', (e) => {
            if (elements.notificationsPanel && !elements.notificationsPanel.contains(e.target) && e.target !== elements.notificationsBtn) {
                elements.notificationsPanel.classList.add('hidden');
            }
        });
        
        // Venda rápida
        if (elements.quickSaleBtn) {
            elements.quickSaleBtn.addEventListener('click', showSaleModal);
        }
        
        // Limpar vendas do dia
        if (elements.clearSalesBtn) {
            elements.clearSalesBtn.addEventListener('click', clearTodaySales);
        }
        
        // Backup
        if (elements.backupNowBtn) elements.backupNowBtn.addEventListener('click', createBackup);
        if (elements.restoreBackupBtn) elements.restoreBackupBtn.addEventListener('click', restoreBackup);
        if (elements.downloadBackupBtn) elements.downloadBackupBtn.addEventListener('click', downloadBackup);
        
        if (elements.backupFrequency) {
            elements.backupFrequency.addEventListener('change', (e) => {
                const frequency = parseInt(e.target.value);
                DB.settings.backup.frequency = frequency;
                setupBackupInterval(frequency);
                saveDB();
            });
        }
        
        if (elements.backupNotifications) {
            elements.backupNotifications.addEventListener('change', (e) => {
                DB.settings.backup.notifyOnBackup = e.target.checked;
                saveDB();
            });
        }
        
        // Configurações
        if (elements.settingsTabs) {
            elements.settingsTabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    elements.settingsTabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    const tabId = `${tab.dataset.tab}-tab`;
                    document.querySelectorAll('.tab-pane').forEach(pane => {
                        pane.classList.remove('active');
                    });
                    document.getElementById(tabId).classList.add('active');
                });
            });
        }
        
        if (elements.companySettingsForm) {
            elements.companySettingsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                DB.settings.company.name = document.getElementById('companyName').value;
                DB.settings.company.address = document.getElementById('companyAddress').value;
                DB.settings.company.phone = document.getElementById('companyPhone').value;
                DB.settings.company.email = document.getElementById('companyEmail').value;
                saveDB();
                showNotification('Configurações Salvas', 'Configurações da empresa atualizadas.', 'success');
            });
        }
        
        if (elements.salesSettingsForm) {
            elements.salesSettingsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                DB.settings.sales.defaultPaymentMethod = document.getElementById('defaultPaymentMethod').value;
                DB.settings.sales.taxPercentage = parseFloat(document.getElementById('taxPercentage').value);
                DB.settings.sales.enableStockControl = document.getElementById('enableStockControl').checked;
                DB.settings.sales.enableLowStockAlert = document.getElementById('enableLowStockAlert').checked;
                saveDB();
                showNotification('Configurações Salvas', 'Configurações de vendas atualizadas.', 'success');
            });
        }
        
        if (elements.notificationsSettingsForm) {
            elements.notificationsSettingsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                DB.settings.notifications.notifyLowStock = document.getElementById('notifyLowStock').checked;
                DB.settings.notifications.notifyOverdue = document.getElementById('notifyOverdue').checked;
                DB.settings.notifications.notifyDailySales = document.getElementById('notifyDailySales').checked;
                DB.settings.notifications.notificationSound = document.getElementById('notificationSound').value;
                saveDB();
                showNotification('Configurações Salvas', 'Configurações de notificações atualizadas.', 'success');
            });
        }
        
        if (elements.addUserBtn) {
            elements.addUserBtn.addEventListener('click', () => showUserModal());
        }
        
        // Modal
        if (elements.modalCancelBtn && elements.modalCloseBtn) {
            [elements.modalCancelBtn, elements.modalCloseBtn].forEach(btn => btn.addEventListener('click', closeModal));
        }
        
        if (elements.modalContainer) {
            elements.modalContainer.addEventListener('click', (e) => {
                if (e.target === elements.modalContainer) closeModal();
            });
        }
        
        if (elements.modalSaveBtn) {
            elements.modalSaveBtn.addEventListener('click', () => {
                if (onSaveCallback && onSaveCallback()) closeModal();
            });
        }
        
        // Botões de ação nas tabelas
        document.querySelector('main').addEventListener('click', (e) => {
            const target = e.target;
            const id = target.dataset.id;
            
            if (target.classList.contains('btn-edit')) showProductModal(id);
            
            if (target.classList.contains('btn-delete')) {
                if (confirm("Tem certeza que deseja excluir este produto?")) {
                    DB.products = DB.products.filter(p => p.id !== Number(id));
                    saveDB();
                    renderAll();
                    showNotification('Produto Excluído', 'Produto excluído com sucesso.', 'success');
                }
            }
            
            if (target.classList.contains('btn-paid')) {
                const receivable = DB.receivables.find(r => r.id === Number(id));
                if (receivable) {
                    receivable.status = 'Pago';
                    saveDB();
                    renderAll();
                    showNotification('Conta Recebida', 'Conta marcada como paga.', 'success');
                }
            }
        });
        
        // Filtros
        document.getElementById('productSearch')?.addEventListener('input', renderProducts);
        document.getElementById('productFilter')?.addEventListener('change', renderProducts);
        document.getElementById('salesDateFilter')?.addEventListener('change', renderSales);
        document.getElementById('salesPaymentFilter')?.addEventListener('change', renderSales);
        
        // Gráficos
        if (elements.chartRange) elements.chartRange.addEventListener('change', setupCharts);
        
        // Relatórios
        const reportTypeCards = document.querySelectorAll('.report-type-card');
        reportTypeCards.forEach(card => {
            card.addEventListener('click', () => {
                reportTypeCards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                const reportType = card.dataset.report;
                showReportOptions(reportType);
            });
        });
        
        document.getElementById('generateReportBtn')?.addEventListener('click', generatePDFReport);
    };

    // --- RENDERIZAÇÃO DE DADOS ---
    const renderAll = () => {
        renderDashboard();
        renderProducts();
        renderSales();
        renderExpenses();
        renderReceivables();
        updateNotificationsUI();
        loadSettingsForms();
    };

    const renderDashboard = () => {
        const today = getTodayDate();
        const todaySales = DB.sales.filter(s => s.date.slice(0, 10) === today);
        const todayRevenue = todaySales.reduce((acc, sale) => acc + sale.total, 0);
        
        if (elements.todayRevenue) elements.todayRevenue.textContent = formatCurrency(todayRevenue);
        if (elements.salesCount) elements.salesCount.textContent = `${todaySales.length} vendas`;
        
        const stockValue = DB.products.reduce((acc, p) => acc + (p.quantity * p.costPrice), 0);
        const stockItems = DB.products.reduce((acc, p) => acc + p.quantity, 0);
        
        if (elements.stockValue) elements.stockValue.textContent = formatCurrency(stockValue);
        if (elements.stockItems) elements.stockItems.textContent = `${stockItems} itens`;
        
        const pendingReceivables = DB.receivables.filter(r => r.status === 'Pendente');
        const receivablesValue = pendingReceivables.reduce((acc, r) => acc + r.value, 0);
        
        if (elements.receivablesValue) elements.receivablesValue.textContent = formatCurrency(receivablesValue);
        if (elements.receivablesCount) elements.receivablesCount.textContent = `${pendingReceivables.length} pendentes`;
        
        const lowStockItems = DB.products.filter(p => p.quantity <= p.lowStockThreshold);
        if (elements.lowStockCount) elements.lowStockCount.textContent = lowStockItems.length;
        if (elements.lowStockItems) elements.lowStockItems.textContent = lowStockItems.length === 1 ? '1 item crítico' : `${lowStockItems.length} itens críticos`;
        
        const now = new Date();
        const thisMonth = now.getMonth();
        const thisYear = now.getFullYear();
        const monthExpenses = DB.expenses.filter(e => {
            const expenseDate = new Date(e.date);
            return expenseDate.getMonth() === thisMonth && expenseDate.getFullYear() === thisYear;
        });
        
        const monthExpensesTotal = monthExpenses.reduce((acc, exp) => acc + exp.value, 0);
        if (elements.monthExpenses) elements.monthExpenses.textContent = formatCurrency(monthExpensesTotal);
        
        const daysInMonth = new Date(thisYear, thisMonth + 1, 0).getDate();
        const dailyAverage = monthExpensesTotal / daysInMonth;
        if (elements.dailyAverage) elements.dailyAverage.textContent = formatCurrency(dailyAverage);
        
        const highestExpense = monthExpenses.length > 0 ? 
            Math.max(...monthExpenses.map(e => e.value)) : 0;
        if (elements.highestExpense) elements.highestExpense.textContent = formatCurrency(highestExpense);
        
        if (elements.recentSalesTable) {
            elements.recentSalesTable.innerHTML = '';
            todaySales.slice(-10).reverse().forEach(sale => {
                const tr = elements.recentSalesTable.insertRow();
                tr.innerHTML = `
                    <td>${new Date(sale.date).toLocaleTimeString('pt-BR')}</td>
                    <td>${sale.client}</td>
                    <td>${sale.products.map(p => p.name).join(', ')}</td>
                    <td>${formatCurrency(sale.total)}</td>
                    <td>${sale.paymentMethod}</td>
                `;
            });
        }
    };

    const renderProducts = () => {
        if (!elements.productsTable) return;
        
        elements.productsTable.innerHTML = '';
        
        let filteredProducts = [...DB.products];
        
        const searchTerm = document.getElementById('productSearch')?.value.toLowerCase() || '';
        if (searchTerm) {
            filteredProducts = filteredProducts.filter(p => 
                p.name.toLowerCase().includes(searchTerm) || 
                p.id.toString().includes(searchTerm)
            );
        }
        
        const filterValue = document.getElementById('productFilter')?.value || 'all';
        if (filterValue === 'low') {
            filteredProducts = filteredProducts.filter(p => p.quantity <= p.lowStockThreshold);
        } else if (filterValue === 'out') {
            filteredProducts = filteredProducts.filter(p => p.quantity === 0);
        }
        
        filteredProducts.forEach(p => {
            const profit = p.salePrice - p.costPrice;
            const profitMargin = p.costPrice > 0 ? (profit / p.costPrice) * 100 : 0;
            const profitClass = profitMargin >= 50 ? 'success' : profitMargin >= 20 ? 'warning' : 'danger';
            
            const tr = elements.productsTable.insertRow();
            tr.style.color = p.quantity <= p.lowStockThreshold ? '#ffc107' : 'inherit';
            tr.innerHTML = `
                <td>${p.id}</td>
                <td>${p.name}</td>
                <td>${p.quantity}</td>
                <td>${p.lowStockThreshold}</td>
                <td>${formatCurrency(p.costPrice)}</td>
                <td>${formatCurrency(p.salePrice)}</td>
                <td class="${profitClass}">${formatCurrency(profit)} (${profitMargin.toFixed(1)}%)</td>
                <td>
                    <button class="btn btn-sm btn-edit" data-id="${p.id}">Editar</button>
                    <button class="btn btn-sm btn-delete" data-id="${p.id}">Excluir</button>
                </td>`;
        });
    };

    const renderSales = () => {
        if (!elements.salesTable) return;
        
        elements.salesTable.innerHTML = '';
        
        let filteredSales = [...DB.sales];
        
        const dateFilter = document.getElementById('salesDateFilter')?.value || 'all';
        const now = new Date();
        
        if (dateFilter === 'today') {
            const today = getTodayDate();
            filteredSales = filteredSales.filter(s => s.date.slice(0, 10) === today);
        } else if (dateFilter === 'week') {
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            
            filteredSales = filteredSales.filter(s => {
                const saleDate = new Date(s.date);
                return saleDate >= startOfWeek;
            });
        } else if (dateFilter === 'month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            
            filteredSales = filteredSales.filter(s => {
                const saleDate = new Date(s.date);
                return saleDate >= startOfMonth;
            });
        }
        
        const paymentFilter = document.getElementById('salesPaymentFilter')?.value || 'all';
        if (paymentFilter !== 'all') {
            filteredSales = filteredSales.filter(s => s.paymentMethod === paymentFilter);
        }
        
        filteredSales.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(s => {
            const tr = elements.salesTable.insertRow();
            tr.innerHTML = `
                <td>${formatDateTime(s.date)}</td>
                <td>${s.client}</td>
                <td>${s.products.map(p => `${p.name} (${p.quantity})`).join(', ')}</td>
                <td>${formatCurrency(s.total)}</td>
                <td>${s.paymentMethod}</td>
                <td>${s.status}</td>
                <td>
                    <button class="btn btn-sm">Detalhes</button>
                </td>`;
        });
    };

    const renderExpenses = () => {
        if (!elements.expensesTable) return;
        
        elements.expensesTable.innerHTML = '';
        
        DB.expenses.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(e => {
            const tr = elements.expensesTable.insertRow();
            tr.innerHTML = `
                <td>${formatDate(e.date)}</td>
                <td>${e.description}</td>
                <td>${e.category}</td>
                <td>${formatCurrency(e.value)}</td>
                <td>${e.provider}</td>
                <td>
                    <button class="btn btn-sm">Editar</button>
                    <button class="btn btn-sm btn-danger">Excluir</button>
                </td>`;
        });
    };
    
    const renderReceivables = () => {
        if (!elements.receivablesTable) return;
        
        elements.receivablesTable.innerHTML = '';
        
        DB.receivables.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).forEach(r => {
            const dueDate = new Date(r.dueDate);
            const today = new Date();
            const diffTime = dueDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let statusClass = '';
            let daysText = '';
            
            if (r.status === 'Pago') {
                statusClass = 'success';
                daysText = 'Pago';
            } else if (diffDays < 0) {
                statusClass = 'danger';
                daysText = `${Math.abs(diffDays)} dias atrasado`;
            } else if (diffDays === 0) {
                statusClass = 'warning';
                daysText = 'Vence hoje';
            } else {
                daysText = `${diffDays} dias`;
            }
            
            const tr = elements.receivablesTable.insertRow();
            tr.innerHTML = `
                <td>${r.client}</td>
                <td>${formatCurrency(r.value)}</td>
                <td>${formatDate(r.dueDate)}</td>
                <td class="${statusClass}">${r.status}</td>
                <td>${daysText}</td>
                <td>
                    ${r.status === 'Pendente' ? 
                        `<button class="btn btn-sm btn-success btn-paid" data-id="${r.id}">Marcar como Pago</button>` : 
                        'Pago'
                    }
                </td>`;
        });
        
        const pendingReceivables = DB.receivables.filter(r => r.status === 'Pendente');
        const totalReceivables = pendingReceivables.reduce((acc, r) => acc + r.value, 0);
        
        const today = new Date();
        const weekLater = new Date();
        weekLater.setDate(today.getDate() + 7);
        const weekReceivables = pendingReceivables
            .filter(r => new Date(r.dueDate) <= weekLater)
            .reduce((acc, r) => acc + r.value, 0);
            
        const overdueReceivables = pendingReceivables
            .filter(r => new Date(r.dueDate) < today)
            .reduce((acc, r) => acc + r.value, 0);
            
        const totalReceivablesEl = document.getElementById('totalReceivables');
        const weekReceivablesEl = document.getElementById('weekReceivables');
        const overdueReceivablesEl = document.getElementById('overdueReceivables');
        
        if (totalReceivablesEl) totalReceivablesEl.textContent = formatCurrency(totalReceivables);
        if (weekReceivablesEl) weekReceivablesEl.textContent = formatCurrency(weekReceivables);
        if (overdueReceivablesEl) overdueReceivablesEl.textContent = formatCurrency(overdueReceivables);
    };

    const loadSettingsForms = () => {
        if (document.getElementById('companyName')) {
            document.getElementById('companyName').value = DB.settings.company.name;
            document.getElementById('companyAddress').value = DB.settings.company.address;
            document.getElementById('companyPhone').value = DB.settings.company.phone;
            document.getElementById('companyEmail').value = DB.settings.company.email;
        }
        
        if (document.getElementById('defaultPaymentMethod')) {
            document.getElementById('defaultPaymentMethod').value = DB.settings.sales.defaultPaymentMethod;
            document.getElementById('taxPercentage').value = DB.settings.sales.taxPercentage;
            document.getElementById('enableStockControl').checked = DB.settings.sales.enableStockControl;
            document.getElementById('enableLowStockAlert').checked = DB.settings.sales.enableLowStockAlert;
        }
        
        if (document.getElementById('notifyLowStock')) {
            document.getElementById('notifyLowStock').checked = DB.settings.notifications.notifyLowStock;
            document.getElementById('notifyOverdue').checked = DB.settings.notifications.notifyOverdue;
            document.getElementById('notifyDailySales').checked = DB.settings.notifications.notifyDailySales;
            document.getElementById('notificationSound').value = DB.settings.notifications.notificationSound;
        }
        
        if (document.getElementById('backupFrequency')) {
            document.getElementById('backupFrequency').value = DB.settings.backup.frequency;
            document.getElementById('backupNotifications').checked = DB.settings.backup.notifyOnBackup;
        }
    };

    // --- GRÁFICOS ---
    const setupCharts = () => {
        setupSalesChart();
        setupProductsChart();
    };

    const setupSalesChart = () => {
        const ctx = document.getElementById('salesChart');
        if (!ctx) return;
        
        const days = parseInt(elements.chartRange?.value || '30');
        
        const salesByCategory = {};
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);
        
        DB.sales.filter(sale => {
            const saleDate = new Date(sale.date);
            return saleDate >= startDate && saleDate <= endDate;
        }).forEach(sale => {
            sale.products.forEach(product => {
                if (!salesByCategory[product.name]) {
                    salesByCategory[product.name] = 0;
                }
                salesByCategory[product.name] += product.quantity * product.price;
            });
        });
        
        const categories = Object.keys(salesByCategory);
        const values = Object.values(salesByCategory);
        
        if (salesChart) {
            salesChart.destroy();
        }
        
        salesChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: categories,
                datasets: [{
                    label: `Vendas (últimos ${days} dias)`,
                    data: values,
                    backgroundColor: 'rgba(255, 94, 0, 0.7)',
                    borderColor: 'rgba(255, 94, 0, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return 'R$ ' + value.toFixed(2);
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return 'R$ ' + context.raw.toFixed(2);
                            }
                        }
                    }
                }
            }
        });
    };

    const setupProductsChart = () => {
        const ctx = document.getElementById('productsChart');
        if (!ctx) return;
        
        const productSales = {};
        
        DB.sales.forEach(sale => {
            sale.products.forEach(product => {
                if (!productSales[product.name]) {
                    productSales[product.name] = 0;
                }
                productSales[product.name] += product.quantity;
            });
        });
        
        const topProducts = Object.entries(productSales)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        const productNames = topProducts.map(p => p[0]);
        const productQuantities = topProducts.map(p => p[1]);
        
        if (productsChart) {
            productsChart.destroy();
        }
        
        productsChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: productNames,
                datasets: [{
                    data: productQuantities,
                    backgroundColor: [
                        'rgba(255, 94, 0, 0.7)',
                        'rgba(255, 193, 7, 0.7)',
                        'rgba(40, 167, 69, 0.7)',
                        'rgba(23, 162, 184, 0.7)',
                        'rgba(108, 117, 125, 0.7)'
                    ],
                    borderColor: [
                        'rgba(255, 94, 0, 1)',
                        'rgba(255, 193, 7, 1)',
                        'rgba(40, 167, 69, 1)',
                        'rgba(23, 162, 184, 1)',
                        'rgba(108, 117, 125, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    };

    // --- MODAL SYSTEM ---
    const openModal = (title, formHTML, onSave, data = null) => {
        currentModalData = data;
        elements.modalTitle.textContent = title;
        elements.modalBody.innerHTML = formHTML;
        onSaveCallback = onSave;
        elements.modalContainer.classList.remove('hidden');
    };

    const closeModal = () => {
        elements.modalContainer.classList.add('hidden');
        onSaveCallback = null;
        currentModalData = null;
    };

    const showProductModal = (id = null) => {
        const product = id ? DB.products.find(p => p.id === Number(id)) : null;
        const title = id ? 'Editar Produto' : 'Adicionar Produto';
        
        const formHTML = `
            <div class="form-group">
                <label for="productName">Nome do Produto</label>
                <input type="text" id="productName" value="${product ? product.name : ''}" required>
            </div>
            <div class="form-group">
                <label for="productQuantity">Estoque Atual</label>
                <input type="number" id="productQuantity" value="${product ? product.quantity : 0}" min="0" required>
            </div>
            <div class="form-group">
                <label for="productLowStock">Estoque Mínimo</label>
                <input type="number" id="productLowStock" value="${product ? product.lowStockThreshold : 5}" min="0" required>
            </div>
            <div class="form-group">
                <label for="productCostPrice">Preço de Custo (R$)</label>
                <input type="text" id="productCostPrice" value="${product ? product.costPrice.toFixed(2).replace('.', ',') : '0,00'}" required>
            </div>
            <div class="form-group">
                <label for="productSalePrice">Preço de Venda (R$)</label>
                <input type="text" id="productSalePrice" value="${product ? product.salePrice.toFixed(2).replace('.', ',') : '0,00'}" required>
            </div>
        `;
        
        const onSave = () => {
            const name = document.getElementById('productName').value;
            const quantity = parseInt(document.getElementById('productQuantity').value, 10);
            const lowStockThreshold = parseInt(document.getElementById('productLowStock').value, 10);
            const costPrice = parseFormattedNumber(document.getElementById('productCostPrice').value);
            const salePrice = parseFormattedNumber(document.getElementById('productSalePrice').value);

            if (!name || isNaN(quantity) || isNaN(costPrice) || isNaN(salePrice) || isNaN(lowStockThreshold)) {
                alert("Por favor, preencha todos os campos corretamente.");
                return false;
            }

            if (id && product) {
                product.name = name;
                product.quantity = quantity;
                product.lowStockThreshold = lowStockThreshold;
                product.costPrice = costPrice;
                product.salePrice = salePrice;
                showNotification('Produto Atualizado', `Produto "${name}" atualizado com sucesso.`, 'success');
            } else {
                const newProduct = {
                    id: Date.now(),
                    name,
                    quantity,
                    lowStockThreshold,
                    costPrice,
                    salePrice
                };
                DB.products.push(newProduct);
                showNotification('Produto Adicionado', `Produto "${name}" adicionado com sucesso.`, 'success');
            }
            
            saveDB();
            renderAll();
            return true;
        };

        openModal(title, formHTML, onSave, product);
    };

    const showSaleModal = () => {
        let currentSaleItems = [];
        const productOptions = DB.products.filter(p => p.quantity > 0)
            .map(p => `<option value="${p.id}">${p.name} (Estoque: ${p.quantity})</option>`)
            .join('');

        const formHTML = `
            <div class="form-group">
                <label for="saleClient">Nome do Cliente</label>
                <input type="text" id="saleClient" value="Consumidor Final" required>
            </div>
            <hr>
            <h4>Adicionar Produtos</h4>
            <div class="sale-product-adder" style="display: flex; gap: 10px; align-items: flex-end;">
                <div class="form-group" style="flex-grow: 1;">
                    <label for="saleProductSelect">Produto</label>
                    <select id="saleProductSelect">${productOptions}</select>
                </div>
                <div class="form-group">
                    <label for="saleProductQuantity">Quantidade</label>
                    <input type="number" id="saleProductQuantity" value="1" min="1" style="width: 100px;">
                </div>
                <button type="button" class="btn btn-primary" id="addSaleItemBtn">Adicionar</button>
            </div>
            <div id="saleItemsList" class="sale-items-list"></div>
            <div id="saleTotal" class="sale-total" style="text-align: right; font-weight: bold; margin: 10px 0;">Total: R$ 0,00</div>
            <hr>
            <h4>Forma de Pagamento</h4>
            <div class="form-group">
                <label for="paymentMethod">Método de Pagamento</label>
                <select id="paymentMethod">
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="PIX">PIX</option>
                    <option value="Cartão">Cartão</option>
                    <option value="Mixto">Misto</option>
                </select>
            </div>
            <div id="mixedPayment" class="mixed-payment hidden">
                <div class="form-group">
                    <label for="paymentCash">Dinheiro (R$)</label>
                    <input type="text" id="paymentCash" placeholder="0,00">
                </div>
                <div class="form-group">
                    <label for="paymentCard">Cartão (R$)</label>
                    <input type="text" id="paymentCard" placeholder="0,00">
                </div>
            </div>
        `;

        openModal('Nova Venda', formHTML, () => {
            const client = document.getElementById('saleClient').value;
            const paymentMethod = document.getElementById('paymentMethod').value;
            let payCash = 0;
            let payCard = 0;
            const saleTotal = currentSaleItems.reduce((acc, item) => acc + item.total, 0);

            if (paymentMethod === 'Mixto') {
                payCash = parseFormattedNumber(document.getElementById('paymentCash').value);
                payCard = parseFormattedNumber(document.getElementById('paymentCard').value);
            } else if (paymentMethod === 'Dinheiro') {
                payCash = saleTotal;
            } else if (paymentMethod === 'Cartão' || paymentMethod === 'PIX') {
                payCard = saleTotal;
            }
            
            const totalPaid = payCash + payCard;

            if (currentSaleItems.length === 0) {
                alert("Adicione pelo menos um produto à venda.");
                return false;
            }
            
            if (paymentMethod === 'Mixto' && totalPaid < saleTotal) {
                alert("O valor pago é menor que o total da venda.");
                return false;
            }
            
            if (!client) {
                alert("Por favor, informe o nome do cliente.");
                return false;
            }

            currentSaleItems.forEach(item => {
                const productInDB = DB.products.find(p => p.id === item.id);
                if (productInDB) {
                    productInDB.quantity -= item.quantity;
                    if (productInDB.quantity <= productInDB.lowStockThreshold && DB.settings.notifications.notifyLowStock) {
                        showNotification('Estoque Baixo', `O produto "${productInDB.name}" está com estoque baixo.`, 'warning');
                    }
                }
            });

            DB.sales.push({
                id: Date.now(),
                date: new Date().toISOString(),
                client,
                products: currentSaleItems.map(p => ({
                    id: p.id,
                    name: p.name,
                    quantity: p.quantity,
                    price: p.price
                })),
                total: saleTotal,
                status: 'Pago',
                paymentMethod: paymentMethod,
                payment: {
                    cash: payCash,
                    card: payCard
                }
            });

            saveDB();
            renderAll();
            showNotification('Venda Registrada', `Venda para ${client} registrada com sucesso.`, 'success');
            return true;
        });

        setTimeout(() => {
            const addSaleItemBtn = document.getElementById('addSaleItemBtn');
            const paymentMethodSelect = document.getElementById('paymentMethod');
            const mixedPaymentDiv = document.getElementById('mixedPayment');
            const saleItemsList = document.getElementById('saleItemsList');
            const saleTotal = document.getElementById('saleTotal');

            if (addSaleItemBtn) {
                addSaleItemBtn.addEventListener('click', () => {
                    const productId = parseInt(document.getElementById('saleProductSelect').value);
                    const quantity = parseInt(document.getElementById('saleProductQuantity').value);
                    const product = DB.products.find(p => p.id === productId);

                    if (!product || isNaN(quantity) || quantity <= 0) {
                        alert("Selecione um produto e quantidade válidos.");
                        return;
                    }

                    if (quantity > product.quantity) {
                        alert(`Estoque insuficiente. Disponível: ${product.quantity}`);
                        return;
                    }

                    const existingItem = currentSaleItems.find(item => item.id === productId);
                    if (existingItem) {
                        existingItem.quantity += quantity;
                        existingItem.total = existingItem.quantity * existingItem.price;
                    } else {
                        currentSaleItems.push({
                            id: product.id,
                            name: product.name,
                            quantity: quantity,
                            price: product.salePrice,
                            total: product.salePrice * quantity
                        });
                    }
                    updateSaleItemsList();
                });
            }

            if (paymentMethodSelect) {
                paymentMethodSelect.addEventListener('change', function() {
                    if (this.value === 'Mixto') {
                        mixedPaymentDiv.classList.remove('hidden');
                    } else {
                        mixedPaymentDiv.classList.add('hidden');
                    }
                });
            }

            const updateSaleItemsList = () => {
                if (!saleItemsList) return;
                
                saleItemsList.innerHTML = '';
                currentSaleItems.forEach(item => {
                    const itemEl = document.createElement('div');
                    itemEl.className = 'sale-item';
                    itemEl.style.display = 'flex';
                    itemEl.style.justifyContent = 'space-between';
                    itemEl.style.padding = '5px 0';
                    itemEl.innerHTML = `
                        <span>${item.quantity}x ${item.name}</span>
                        <span>${formatCurrency(item.total)}</span>
                        <button type="button" class="btn btn-sm btn-danger" data-id="${item.id}">Remover</button>
                    `;
                    
                    itemEl.querySelector('button').addEventListener('click', () => {
                        currentSaleItems = currentSaleItems.filter(i => i.id !== item.id);
                        updateSaleItemsList();
                    });
                    
                    saleItemsList.appendChild(itemEl);
                });
                
                const total = currentSaleItems.reduce((acc, item) => acc + item.total, 0);
                if (saleTotal) {
                    saleTotal.textContent = `Total: ${formatCurrency(total)}`;
                }
            };
        }, 100);
    };

    const showExpenseModal = () => {
        const formHTML = `
            <div class="form-group">
                <label for="expenseDate">Data</label>
                <input type="date" id="expenseDate" value="${getTodayDate()}" required>
            </div>
            <div class="form-group">
                <label for="expenseDescription">Descrição</label>
                <input type="text" id="expenseDescription" required>
            </div>
            <div class="form-group">
                <label for="expenseCategory">Categoria</label>
                <input type="text" id="expenseCategory" required>
            </div>
            <div class="form-group">
                <label for="expenseValue">Valor (R$)</label>
                <input type="text" id="expenseValue" required>
            </div>
            <div class="form-group">
                <label for="expenseProvider">Fornecedor</label>
                <input type="text" id="expenseProvider" required>
            </div>
        `;

        const onSave = () => {
            const date = document.getElementById('expenseDate').value;
            const description = document.getElementById('expenseDescription').value;
            const category = document.getElementById('expenseCategory').value;
            const value = parseFormattedNumber(document.getElementById('expenseValue').value);
            const provider = document.getElementById('expenseProvider').value;

            if (!date || !description || !category || isNaN(value) || value <= 0 || !provider) {
                alert("Por favor, preencha todos os campos corretamente.");
                return false;
            }

            DB.expenses.push({
                id: Date.now(),
                date,
                description,
                category,
                value,
                provider
            });

            saveDB();
            renderAll();
            showNotification('Gasto Registrado', `Gasto "${description}" registrado com sucesso.`, 'success');
            return true;
        };

        openModal('Adicionar Gasto', formHTML, onSave);
    };

    const showReceivableModal = () => {
        const formHTML = `
            <div class="form-group">
                <label for="receivableClient">Cliente</label>
                <input type="text" id="receivableClient" required>
            </div>
            <div class="form-group">
                <label for="receivableValue">Valor (R$)</label>
                <input type="text" id="receivableValue" required>
            </div>
            <div class="form-group">
                <label for="receivableDueDate">Data de Vencimento</label>
                <input type="date" id="receivableDueDate" value="${getTodayDate()}" required>
            </div>
        `;

        const onSave = () => {
            const client = document.getElementById('receivableClient').value;
            const value = parseFormattedNumber(document.getElementById('receivableValue').value);
            const dueDate = document.getElementById('receivableDueDate').value;

            if (!client || isNaN(value) || value <= 0 || !dueDate) {
                alert("Por favor, preencha todos os campos corretamente.");
                return false;
            }

            DB.receivables.push({
                id: Date.now(),
                client,
                value,
                dueDate,
                status: 'Pendente'
            });

            saveDB();
            renderAll();
            showNotification('Conta a Receber Adicionada', `Conta de ${client} adicionada com sucesso.`, 'success');
            return true;
        };

        openModal('Adicionar Conta a Receber', formHTML, onSave);
    };

    const showUserModal = () => {
        const formHTML = `
            <div class="form-group">
                <label for="userName">Nome Completo</label>
                <input type="text" id="userName" required>
            </div>
            <div class="form-group">
                <label for="userUsername">Usuário</label>
                <input type="text" id="userUsername" required>
            </div>
            <div class="form-group">
                <label for="userPassword">Senha</label>
                <input type="password" id="userPassword" required>
            </div>
            <div class="form-group">
                <label for="userRole">Função</label>
                <select id="userRole" required>
                    <option value="user">Usuário</option>
                    <option value="manager">Gerente</option>
                    <option value="admin">Administrador</option>
                </select>
            </div>
        `;

        const onSave = () => {
            const name = document.getElementById('userName').value;
            const username = document.getElementById('userUsername').value;
            const password = document.getElementById('userPassword').value;
            const role = document.getElementById('userRole').value;

            if (!name || !username || !password || !role) {
                alert("Por favor, preencha todos os campos corretamente.");
                return false;
            }

            if (DB.users.find(u => u.username === username)) {
                alert("Já existe um usuário com este nome de usuário.");
                return false;
            }

            DB.users.push({ name, username, password, role });
            saveDB();
            showNotification('Usuário Adicionado', `Usuário "${name}" adicionado com sucesso.`, 'success');
            return true;
        };

        openModal('Adicionar Usuário', formHTML, onSave);
    };

    const showReportOptions = (reportType) => {
        const reportOptions = document.getElementById('reportOptions');
        const reportOptionsTitle = document.getElementById('reportOptionsTitle');
        const reportCategoryGroup = document.getElementById('reportCategoryGroup');
        
        if (!reportOptions || !reportOptionsTitle) return;
        
        reportOptions.classList.remove('hidden');
        
        switch (reportType) {
            case 'sales':
                reportOptionsTitle.textContent = 'Opções do Relatório de Vendas';
                if (reportCategoryGroup) reportCategoryGroup.classList.remove('hidden');
                break;
            case 'products':
                reportOptionsTitle.textContent = 'Opções do Relatório de Estoque';
                if (reportCategoryGroup) reportCategoryGroup.classList.add('hidden');
                break;
            case 'financial':
                reportOptionsTitle.textContent = 'Opções do Relatório Financeiro';
                if (reportCategoryGroup) reportCategoryGroup.classList.add('hidden');
                break;
            case 'receivables':
                reportOptionsTitle.textContent = 'Opções do Relatório de Contas a Receber';
                if (reportCategoryGroup) reportCategoryGroup.classList.add('hidden');
                break;
        }
        
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        document.getElementById('reportStartDate').value = firstDay.toISOString().slice(0, 10);
        document.getElementById('reportEndDate').value = today.toISOString().slice(0, 10);
    };

    // --- RELATÓRIOS PDF ---
    const generatePDFReport = () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const reportType = document.querySelector('.report-type-card.active')?.dataset.report;
        const startDate = document.getElementById('reportStartDate')?.value;
        const endDate = document.getElementById('reportEndDate')?.value;
        
        if (!reportType) {
            alert('Selecione um tipo de relatório primeiro.');
            return;
        }
        
        if (!startDate || !endDate) {
            alert('Selecione um período para o relatório.');
            return;
        }
        
        doc.setFontSize(18);
        doc.text(`Relatório - ${reportType.toUpperCase()}`, 105, 15, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Período: ${formatDate(startDate)} até ${formatDate(endDate)}`, 105, 25, { align: 'center' });
        
        let yPosition = 35;
        
        switch(reportType) {
            case 'sales':
                const filteredSales = DB.sales.filter(s => new Date(s.date) >= new Date(startDate) && new Date(s.date) <= new Date(endDate));
                doc.text(`Total de Vendas: ${formatCurrency(filteredSales.reduce((acc, s) => acc + s.total, 0))}`, 14, yPosition);
                yPosition += 10;
                doc.autoTable({
                    startY: yPosition,
                    head: [['Data', 'Cliente', 'Valor', 'Pagamento']],
                    body: filteredSales.map(s => [formatDate(s.date), s.client, formatCurrency(s.total), s.paymentMethod || 'N/D'])
                });
                break;
            case 'products':
                doc.text(`Valor Total do Estoque: ${formatCurrency(DB.products.reduce((acc, p) => acc + (p.quantity * p.costPrice), 0))}`, 14, yPosition);
                yPosition += 10;
                doc.autoTable({
                    startY: yPosition,
                    head: [['Nome', 'Estoque', 'Mínimo', 'Preço Venda']],
                    body: DB.products.map(p => [p.name, p.quantity, p.lowStockThreshold, formatCurrency(p.salePrice)])
                });
                break;
            case 'financial':
                const salesInPeriod = DB.sales.filter(s => new Date(s.date) >= new Date(startDate) && new Date(s.date) <= new Date(endDate));
                const expensesInPeriod = DB.expenses.filter(e => new Date(e.date) >= new Date(startDate) && new Date(e.date) <= new Date(endDate));
                const totalSales = salesInPeriod.reduce((acc, s) => acc + s.total, 0);
                const totalExpenses = expensesInPeriod.reduce((acc, e) => acc + e.value, 0);
                const profit = totalSales - totalExpenses;
                
                doc.text(`Receitas: ${formatCurrency(totalSales)}`, 14, yPosition); yPosition += 7;
                doc.text(`Despesas: ${formatCurrency(totalExpenses)}`, 14, yPosition); yPosition += 7;
                doc.text(`Lucro: ${formatCurrency(profit)}`, 14, yPosition); yPosition += 10;
                
                doc.autoTable({
                    startY: yPosition,
                    head: [['Data', 'Descrição', 'Categoria', 'Valor']],
                    body: expensesInPeriod.map(e => [formatDate(e.date), e.description, e.category, formatCurrency(e.value)])
                });
                break;
            case 'receivables':
                const pendingReceivables = DB.receivables.filter(r => r.status === 'Pendente');
                doc.text(`Total a Receber: ${formatCurrency(pendingReceivables.reduce((acc, r) => acc + r.value, 0))}`, 14, yPosition);
                yPosition += 10;
                doc.autoTable({
                    startY: yPosition,
                    head: [['Cliente', 'Valor', 'Vencimento', 'Status']],
                    body: DB.receivables.map(r => [r.client, formatCurrency(r.value), formatDate(r.dueDate), r.status])
                });
                break;
        }
        
        doc.save(`relatorio_${reportType}_${getTodayDate()}.pdf`);
        showNotification('Relatório Gerado', `Relatório ${reportType} gerado com sucesso.`, 'success');
    };

    // --- OUTRAS FUNÇÕES ---
    const clearTodaySales = () => {
        if (confirm('Tem certeza que deseja limpar todas as vendas de hoje? Esta ação não pode ser desfeita.')) {
            const today = getTodayDate();
            DB.sales = DB.sales.filter(sale => sale.date.slice(0, 10) !== today);
            saveDB();
            renderAll();
            showNotification('Vendas Limpas', 'Vendas de hoje foram limpas com sucesso.', 'success');
        }
    };

    // --- INICIALIZAÇÃO ---
    const init = () => {
        // Carregar tema salvo
        const savedTheme = localStorage.getItem('conteinerBeer_theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
            if (elements.themeToggle) {
                elements.themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            }
        }

        // CORREÇÃO: Listener do formulário de login movido para cá para garantir que ele seja ativado no início.
        if (elements.loginForm) {
            elements.loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const username = elements.username.value;
                const password = elements.password.value;
                
                if (login(username, password)) {
                    elements.username.value = '';
                    elements.password.value = '';
                } else {
                    alert('Usuário ou senha incorretos.');
                }
            });
        }
        
        // Adiciona a classe 'collapsed' no menu em telas móveis para que ele comece fechado.
        if (window.innerWidth <= 768) {
            elements.sidebar.classList.add('collapsed');
        }
        
        // Inicializar sistema de login (que decide qual tela mostrar)
        setupLoginSystem();
        
        // Adicionar event listeners para botões de criação que só existem na tela principal
        document.getElementById('addProductBtn')?.addEventListener('click', () => showProductModal());
        document.getElementById('addSaleBtn')?.addEventListener('click', showSaleModal);
        document.getElementById('addExpenseBtn')?.addEventListener('click', showExpenseModal);
        document.getElementById('addReceivableBtn')?.addEventListener('click', showReceivableModal);
    };

    init();
});
