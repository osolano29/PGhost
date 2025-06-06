// ================ CONFIGURACIÓN INICIAL ================
import { CONTRACT_CONFIG, AMOY_CONFIG } from './ghost-token.js';

// Variables globales
let web3, contract, userAddress, isOwner = false, isAuxiliary = false;

// Elementos del DOM
const DOM = {
    // Elementos de conexión
    connectWallet: document.getElementById('connectWallet'),
    disconnectWallet: document.getElementById('disconnectWallet'),
    networkStatus: document.getElementById('networkStatus'),
    networkStatusText: document.getElementById('networkStatusText'),
    walletInfo: document.getElementById('walletInfo'),
    walletAddress: document.getElementById('walletAddress'),
    
    // Información del token
    tokenBalance: document.getElementById('tokenBalance'),
    totalSupply: document.getElementById('totalSupply'),
    contractPausedStatus: document.getElementById('contractPausedStatus'),
    walletPausedStatus: document.getElementById('walletPausedStatus'),
    refreshBalance: document.getElementById('refreshBalance'),
    
    // Transferencias
    transferTokens: document.getElementById('transferTokens'),
    recipientAddress: document.getElementById('recipientAddress'),
    transferAmount: document.getElementById('transferAmount'),
    
    // Quemado
    burnTokens: document.getElementById('burnTokens'),
    burnAmount: document.getElementById('burnAmount'),
    
    // Seguridad
    pauseWallet: document.getElementById('pauseWallet'),
    unpauseWallet: document.getElementById('unpauseWallet'),
    
    // Funciones de owner
    mintTokens: document.getElementById('mintTokens'),
    mintAddress: document.getElementById('mintAddress'),
    mintAmount: document.getElementById('mintAmount'),
    pauseContract: document.getElementById('pauseContract'),
    unpauseContract: document.getElementById('unpauseContract'),
    
    // Sistema de recovery
    approveRecoveryBtn: document.getElementById('approveRecoveryBtn'),
    executeRecoveryBtn: document.getElementById('executeRecoveryBtn'),
    recoveryNominee: document.getElementById('recoveryNominee'),
    recoveryDeadline: document.getElementById('recoveryDeadline'),
    recoveryApproved: document.getElementById('recoveryApproved'),
    recoveryRemainingTime: document.getElementById('recoveryRemainingTime'),
    
    // Funciones de auxiliar
    setAuxiliaryBtn: document.getElementById('setAuxiliaryBtn'),
    claimOwnershipBtn: document.getElementById('claimOwnershipBtn'),
    newAuxiliary: document.getElementById('newAuxiliary'),
    auxiliaryAddress: document.getElementById('auxiliaryAddress'),
    
    // UI Elements
    loader: document.getElementById('loader'),
    loaderText: document.getElementById('loaderText'),
    notification: document.getElementById('notification'),
    notificationMessage: document.getElementById('notificationMessage'),
    ownerSection: document.getElementById('ownerSection'),
    auxiliarySection: document.getElementById('auxiliarySection'),
    metaMaskModal: document.getElementById('metaMaskModal')
};

// ================ INICIALIZACIÓN ================
export async function initApp() {
    if (!verifyCriticalDOM()) {
        console.error("Elementos críticos del DOM no encontrados");
        return;
    }

    setupEventListeners();
    setupModalCloseButton();
    
    // Verificación inicial silenciosa
    try {
        if (window.ethereum?.selectedAddress) {
            await connectWallet(true); // Modo silencioso
        }
    } catch (e) {
        console.log("Verificación inicial fallida:", e.message);
    }
}

function verifyCriticalDOM() {
    const requiredElements = [
        'connectWallet', 'networkStatus', 'walletInfo',
        'transferTokens', 'burnTokens', 'loader'
    ];
    
    return requiredElements.every(id => {
        const exists = document.getElementById(id) !== null;
        if (!exists) console.error(`Elemento faltante: #${id}`);
        return exists;
    });
}

function setupModalCloseButton() {
    if (!DOM.metaMaskModal) return;
    
    const closeButton = DOM.metaMaskModal.querySelector('.close');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            DOM.metaMaskModal.style.display = 'none';
        });
    }
}

// ================ GESTIÓN DE CONEXIÓN ================
async function connectWallet(silent = false) {
    try {
        if (!silent) showLoader("Conectando con MetaMask...");
        
        const provider = detectProvider();
        if (!provider) {
            if (!silent && !isMetaMaskInstalled()) {
                showMetaMaskModal();
                throw new Error("MetaMask no detectado");
            }
            throw new Error("Proveedor no disponible");
        }

        web3 = new Web3(provider);
        const accounts = await provider.request({ 
            method: 'eth_requestAccounts' 
        }).catch(err => {
            throw new Error("El usuario rechazó la conexión");
        });
        
        if (!accounts?.length) {
            throw new Error("No se obtuvieron cuentas");
        }
        
        userAddress = accounts[0];
        await setupNetwork();
        initContract();
        await loadInitialData();
        
        updateConnectionStatus(true, userAddress);
        if (!silent) showNotification("Wallet conectada correctamente", "success");
        return true;
        
    } catch (error) {
        if (!silent) {
            handleError(error, "Error al conectar");
        }
        updateConnectionStatus(false);
        return false;
    } finally {
        if (!silent) hideLoader();
    }
}

function disconnectWallet() {
    updateConnectionStatus(false);
    showNotification("Wallet desconectada", "info");
    resetAppState();
}

function updateConnectionStatus(isConnected, address = null) {
    if (!DOM.networkStatus || !DOM.walletInfo || !DOM.connectWallet) return;

    const statusIndicator = DOM.networkStatus.querySelector('.status-indicator');
    
    if (isConnected) {
        DOM.networkStatus.classList.remove('disconnected');
        DOM.networkStatus.classList.add('connected');
        if (DOM.networkStatusText) DOM.networkStatusText.textContent = 'Conectado';
        if (statusIndicator) statusIndicator.className = 'status-indicator connected';
        if (DOM.walletInfo) DOM.walletInfo.style.display = 'flex';
        if (DOM.connectWallet) DOM.connectWallet.style.display = 'none';
        if (DOM.walletAddress && address) DOM.walletAddress.textContent = shortAddress(address);
    } else {
        DOM.networkStatus.classList.remove('connected');
        DOM.networkStatus.classList.add('disconnected');
        if (DOM.networkStatusText) DOM.networkStatusText.textContent = 'Desconectado';
        if (statusIndicator) statusIndicator.className = 'status-indicator disconnected';
        if (DOM.walletInfo) DOM.walletInfo.style.display = 'none';
        if (DOM.connectWallet) DOM.connectWallet.style.display = 'flex';
    }
}

function detectProvider() {
    if (typeof window.ethereum !== 'undefined') {
        // Manejar múltiples proveedores
        if (window.ethereum.providers?.length) {
            return window.ethereum.providers.find(p => p.isMetaMask) || window.ethereum;
        }
        return window.ethereum;
    }
    
    if (typeof window.web3 !== 'undefined' && window.web3.currentProvider?.isMetaMask) {
        return window.web3.currentProvider;
    }
    
    if (window.ethereum?.isMetaMask) {
        return window.ethereum;
    }
    
    return null;
}

function isMetaMaskInstalled() {
    return !!window.ethereum?.isMetaMask || !!window.web3?.currentProvider?.isMetaMask;
}

function showMetaMaskModal() {
    if (DOM.metaMaskModal) {
        DOM.metaMaskModal.style.display = 'flex';
    }
}

function setupWalletListeners() {
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length > 0) {
                userAddress = accounts[0];
                updateConnectionStatus(true, userAddress);
                loadInitialData();
            } else {
                disconnectWallet();
            }
        });
        
        window.ethereum.on('chainChanged', () => {
            window.location.reload();
        });
    }
}

// ================ INTERACCIÓN CON EL CONTRATO ================
async function setupNetwork() {
    try {
        const chainId = await web3.eth.getChainId();
        if (chainId !== 80002) { // Polygon Amoy
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: AMOY_CONFIG.chainId }]
                });
            } catch (switchError) {
                if (switchError.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [AMOY_CONFIG]
                    });
                }
                throw new Error("Por favor cambia a Polygon Amoy");
            }
        }
    } catch (error) {
        handleError(error, "Error configurando red");
        throw error;
    }
}

function initContract() {
    contract = new web3.eth.Contract(
        CONTRACT_CONFIG.abi,
        CONTRACT_CONFIG.networks["80002"].address
    );
}

async function loadInitialData() {
    try {
        showLoader("Cargando datos...");
        
        const [
            balance, 
            supply, 
            paused, 
            walletPaused, 
            auxiliary, 
            recoveryData,
            owner
        ] = await Promise.all([
            contract.methods.balanceOf(userAddress).call(),
            contract.methods.totalSupply().call(),
            contract.methods.paused().call(),
            contract.methods.isWalletPaused(userAddress).call(),
            contract.methods.auxiliaryOwner().call(),
            contract.methods.recoveryStatus().call(),
            contract.methods.owner().call()
        ]);
        
        // Actualizar UI
        DOM.tokenBalance.textContent = `${web3.utils.fromWei(balance, 'ether')} GO`;
        DOM.totalSupply.textContent = `${web3.utils.fromWei(supply, 'ether')} GO`;
        updateContractStatusUI(paused);
        updateWalletStatusUI(walletPaused);
        
        // Verificar roles
        isOwner = userAddress.toLowerCase() === owner.toLowerCase();
        isAuxiliary = userAddress.toLowerCase() === auxiliary.toLowerCase();
        toggleRoleSections();
        
        // Actualizar datos adicionales
        updateRecoveryUI(recoveryData);
        updateAuxiliaryUI(auxiliary);
        
    } catch (error) {
        handleError(error, "Error cargando datos");
    } finally {
        hideLoader();
    }
}

function updateContractStatusUI(paused) {
    if (DOM.contractPausedStatus) {
        DOM.contractPausedStatus.textContent = paused ? '⛔ PAUSADO' : '✅ Activo';
        DOM.contractPausedStatus.className = paused ? 'status-badge paused' : 'status-badge active';
    }
}

function updateWalletStatusUI(paused) {
    if (DOM.walletPausedStatus) {
        DOM.walletPausedStatus.textContent = paused ? '⛔ PAUSADA' : '✅ Activa';
        DOM.walletPausedStatus.className = paused ? 'status-badge paused' : 'status-badge active';
    }
}

function updateRecoveryUI({nominee, deadline, approved, remainingTime}) {
    if (DOM.recoveryNominee) {
        DOM.recoveryNominee.textContent = nominee === '0x0000000000000000000000000000000000000000' 
            ? 'Ninguno' 
            : shortAddress(nominee);
    }
    
    if (DOM.recoveryDeadline) {
        DOM.recoveryDeadline.textContent = deadline === '0' 
            ? 'N/A' 
            : new Date(deadline * 1000).toLocaleString();
    }
    
    if (DOM.recoveryApproved) {
        DOM.recoveryApproved.textContent = approved ? '✅ Aprobado' : '❌ No aprobado';
    }
    
    if (DOM.recoveryRemainingTime) {
        if (remainingTime > 0) {
            const days = Math.floor(remainingTime / 86400);
            const hours = Math.floor((remainingTime % 86400) / 3600);
            DOM.recoveryRemainingTime.textContent = `${days}d ${hours}h`;
            
            if (days < 1) {
                DOM.recoveryRemainingTime.className = 'recovery-value danger';
            } else if (days < 3) {
                DOM.recoveryRemainingTime.className = 'recovery-value warning';
            } else {
                DOM.recoveryRemainingTime.className = 'recovery-value';
            }
        } else {
            DOM.recoveryRemainingTime.textContent = deadline === '0' ? 'N/A' : 'Expirado';
            DOM.recoveryRemainingTime.className = 'recovery-value';
        }
    }
}

function updateAuxiliaryUI(auxiliary) {
    if (DOM.auxiliaryAddress) {
        DOM.auxiliaryAddress.textContent = auxiliary === '0x0000000000000000000000000000000000000000' 
            ? 'No asignado' 
            : shortAddress(auxiliary);
    }
}

function toggleRoleSections() {
    if (DOM.ownerSection) {
        DOM.ownerSection.style.display = isOwner ? 'block' : 'none';
    }
    if (DOM.auxiliarySection) {
        DOM.auxiliarySection.style.display = isAuxiliary ? 'block' : 'none';
    }
}

// ================ FUNCIONES DE TRANSACCIÓN ================
async function transferTokens() {
    try {
        const recipient = DOM.recipientAddress.value;
        const amount = DOM.transferAmount.value;
        
        validateAddress(recipient);
        validateAmount(amount);
        
        showLoader("Enviando transferencia...");
        const tx = await contract.methods.transfer(
            recipient, 
            web3.utils.toWei(amount, 'ether')
        ).send({ from: userAddress });
        
        showNotification("Transferencia exitosa!", "success");
        await loadInitialData();
        return tx;
        
    } catch (error) {
        handleError(error, "Error en transferencia");
        throw error;
    } finally {
        hideLoader();
    }
}

async function burnTokens() {
    try {
        const amount = DOM.burnAmount.value;
        validateAmount(amount);
        
        showLoader("Procesando quema...");
        const tx = await contract.methods.burn(
            web3.utils.toWei(amount, 'ether')
        ).send({ from: userAddress });
        
        showNotification("Tokens quemados exitosamente", "success");
        await loadInitialData();
        return tx;
        
    } catch (error) {
        handleError(error, "Error quemando tokens");
        throw error;
    } finally {
        hideLoader();
    }
}

async function mintTokens() {
    if (!isOwner) {
        showNotification("Solo el owner puede mintear tokens", "error");
        return;
    }
    
    try {
        const recipient = DOM.mintAddress.value;
        const amount = DOM.mintAmount.value;
        
        validateAddress(recipient);
        validateAmount(amount);
        
        showLoader("Minteando tokens...");
        const tx = await contract.methods.mint(
            recipient,
            web3.utils.toWei(amount, 'ether')
        ).send({ from: userAddress });
        
        showNotification("Tokens minteados exitosamente!", "success");
        await loadInitialData();
        return tx;
        
    } catch (error) {
        handleError(error, "Error minteando tokens");
        throw error;
    } finally {
        hideLoader();
    }
}

async function toggleWalletPause(pause) {
    try {
        showLoader(pause ? "Pausando wallet..." : "Reanudando wallet...");
        const method = pause ? 'pauseMyWallet' : 'unpauseMyWallet';
        const tx = await contract.methods[method]().send({ from: userAddress });
        
        showNotification(
            pause ? "Wallet pausada correctamente" : "Wallet reanudada correctamente", 
            "success"
        );
        await loadInitialData();
        return tx;
        
    } catch (error) {
        handleError(error, pause ? "Error pausando wallet" : "Error reanudando wallet");
        throw error;
    } finally {
        hideLoader();
    }
}

async function toggleContractPause(pause) {
    if (!isOwner) {
        showNotification("Solo el owner puede pausar el contrato", "error");
        return;
    }
    
    try {
        showLoader(pause ? "Pausando contrato..." : "Reanudando contrato...");
        const method = pause ? 'pause' : 'unpause';
        const tx = await contract.methods[method]().send({ from: userAddress });
        
        showNotification(
            pause ? "Contrato pausado correctamente" : "Contrato reanudado correctamente", 
            "success"
        );
        await loadInitialData();
        return tx;
        
    } catch (error) {
        handleError(error, pause ? "Error pausando contrato" : "Error reanudando contrato");
        throw error;
    } finally {
        hideLoader();
    }
}

async function setAuxiliaryOwner() {
    if (!isOwner) {
        showNotification("Solo el owner puede asignar auxiliar", "error");
        return;
    }
    
    try {
        const newAuxiliary = DOM.newAuxiliary.value;
        validateAddress(newAuxiliary);
        
        showLoader("Actualizando auxiliar...");
        const tx = await contract.methods.setAuxiliaryOwner(newAuxiliary)
            .send({ from: userAddress });
        
        showNotification("Auxiliar actualizado correctamente", "success");
        await loadInitialData();
        return tx;
        
    } catch (error) {
        handleError(error, "Error asignando auxiliar");
        throw error;
    } finally {
        hideLoader();
    }
}

async function approveRecovery(approve) {
    if (!isOwner) {
        showNotification("Solo el owner puede aprobar recovery", "error");
        return;
    }
    
    try {
        showLoader(approve ? "Aprobando recovery..." : "Rechazando recovery...");
        const tx = await contract.methods.approveRecovery(approve)
            .send({ from: userAddress });
        
        showNotification(
            approve ? "Recovery aprobado correctamente" : "Recovery rechazado", 
            "success"
        );
        await loadInitialData();
        return tx;
        
    } catch (error) {
        handleError(error, "Error en aprobación de recovery");
        throw error;
    } finally {
        hideLoader();
    }
}

async function executeRecovery() {
    try {
        showLoader("Ejecutando recovery...");
        const tx = await contract.methods.executeRecovery()
            .send({ from: userAddress });
        
        showNotification("¡Ownership transferido exitosamente!", "success");
        await loadInitialData();
        return tx;
        
    } catch (error) {
        handleError(error, "Error ejecutando recovery");
        throw error;
    } finally {
        hideLoader();
    }
}

async function claimOwnership() {
    if (!isAuxiliary) {
        showNotification("Solo el auxiliar puede iniciar recovery", "error");
        return;
    }
    
    try {
        showLoader("Iniciando proceso de recovery...");
        const tx = await contract.methods.claimOwnershipFromAuxiliary()
            .send({ from: userAddress });
        
        showNotification("Proceso de recovery iniciado", "success");
        await loadInitialData();
        return tx;
        
    } catch (error) {
        handleError(error, "Error iniciando recovery");
        throw error;
    } finally {
        hideLoader();
    }
}

// ================ FUNCIONES AUXILIARES ================
function setupEventListeners() {
    // Conexión
    if (DOM.connectWallet) DOM.connectWallet.addEventListener('click', connectWallet);
    if (DOM.disconnectWallet) DOM.disconnectWallet.addEventListener('click', disconnectWallet);
    if (DOM.refreshBalance) DOM.refreshBalance.addEventListener('click', loadInitialData);
    
    // Transferencias
    if (DOM.transferTokens) DOM.transferTokens.addEventListener('click', transferTokens);
    if (DOM.burnTokens) DOM.burnTokens.addEventListener('click', burnTokens);
    
    // Seguridad
    if (DOM.pauseWallet) DOM.pauseWallet.addEventListener('click', () => toggleWalletPause(true));
    if (DOM.unpauseWallet) DOM.unpauseWallet.addEventListener('click', () => toggleWalletPause(false));
    
    // Owner functions
    if (DOM.mintTokens) DOM.mintTokens.addEventListener('click', mintTokens);
    if (DOM.pauseContract) DOM.pauseContract.addEventListener('click', () => toggleContractPause(true));
    if (DOM.unpauseContract) DOM.unpauseContract.addEventListener('click', () => toggleContractPause(false));
    if (DOM.setAuxiliaryBtn) DOM.setAuxiliaryBtn.addEventListener('click', setAuxiliaryOwner);
    
    // Recovery
    if (DOM.approveRecoveryBtn) DOM.approveRecoveryBtn.addEventListener('click', () => approveRecovery(true));
    if (DOM.executeRecoveryBtn) DOM.executeRecoveryBtn.addEventListener('click', executeRecovery);
    if (DOM.claimOwnershipBtn) DOM.claimOwnershipBtn.addEventListener('click', claimOwnership);
}

function validateAddress(address) {
    if (!web3.utils.isAddress(address)) {
        throw new Error("Dirección inválida");
    }
}

function validateAmount(amount) {
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
        throw new Error("Cantidad inválida");
    }
}

function shortAddress(address) {
    return address ? `${address.substring(0, 6)}...${address.substring(38)}` : "N/A";
}

function resetAppState() {
    userAddress = null;
    isOwner = false;
    isAuxiliary = false;
    
    if (DOM.tokenBalance) DOM.tokenBalance.textContent = "0.00 GO";
    if (DOM.totalSupply) DOM.totalSupply.textContent = "-";
    if (DOM.contractPausedStatus) DOM.contractPausedStatus.textContent = "-";
    if (DOM.walletPausedStatus) DOM.walletPausedStatus.textContent = "-";
    if (DOM.ownerSection) DOM.ownerSection.style.display = 'none';
    if (DOM.auxiliarySection) DOM.auxiliarySection.style.display = 'none';
}

// ================ MANEJO DE UI ================
function showLoader(message = "Procesando...") {
    if (DOM.loaderText) DOM.loaderText.textContent = message;
    if (DOM.loader) DOM.loader.style.display = 'flex';
}

function hideLoader() {
    if (DOM.loader) DOM.loader.style.display = 'none';
}

function showNotification(message, type = "success") {
    if (!DOM.notification || !DOM.notificationMessage) return;
    
    DOM.notificationMessage.textContent = message;
    DOM.notification.className = `notification show ${type}`;
    
    setTimeout(() => {
        DOM.notification.classList.remove('show');
    }, 5000);
}

function handleError(error, context = "") {
    console.error(context, error);
    
    let message = error.message;
    if (error.code === 4001) {
        message = "Transacción cancelada por el usuario";
    } else if (error.message.includes("user denied transaction")) {
        message = "Transacción rechazada";
    } else if (error.message.includes("insufficient funds")) {
        message = "Fondos insuficientes para gas";
    } else if (error.message.includes("wallet paused")) {
        message = "Wallet pausada - operación no permitida";
    } else if (error.message.includes("contract paused")) {
        message = "Contrato pausado - operación no disponible";
    }
    
    showNotification(`${context}: ${message}`, "error");
}

// Inicialización de listeners
if (document.readyState !== 'loading') {
    initApp();
} else {
    document.addEventListener('DOMContentLoaded', initApp);
}

// Configurar listeners de wallet
setupWalletListeners();
