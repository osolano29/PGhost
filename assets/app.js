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
    auxiliarySection: document.getElementById('auxiliarySection')
};

// ================ FUNCIONES PRINCIPALES ================
export async function initApp() {
    setupEventListeners();
    
    // Verificar si hay una wallet conectada al cargar
    if (window.ethereum?.selectedAddress) {
        await connectWallet();
    } else {
        updateConnectionStatus(false);
    }
    
    // Manejar cambios en la wallet
    setupWalletListeners();
}

// ================ CONEXIÓN Y ESTADO ================
async function connectWallet() {
    try {
        showLoader("Conectando con MetaMask...");
        
        // 1. Detectar proveedor
        const provider = detectProvider();
        if (!provider) {
            showMetaMaskModal();
            return false;
        }

        // 2. Configurar Web3 y conectar
        web3 = new Web3(provider);
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
        userAddress = accounts[0];
        
        // 3. Configurar red y contrato
        await setupNetwork();
        initContract();
        
        // 4. Cargar datos iniciales
        await loadInitialData();
        
        // 5. Actualizar UI
        updateConnectionStatus(true, userAddress);
        showNotification("Wallet conectada correctamente", "success");
        return true;
        
    } catch (error) {
        handleError(error, "Error al conectar");
        updateConnectionStatus(false);
        return false;
    } finally {
        hideLoader();
    }
}

function disconnectWallet() {
    // Nota: MetaMask no permite desconexión programática, esto es solo UI
    updateConnectionStatus(false);
    showNotification("Wallet desconectada", "info");
    resetAppState();
}

function updateConnectionStatus(isConnected, address = null) {
    if (isConnected) {
        DOM.networkStatus.classList.remove('disconnected');
        DOM.networkStatus.classList.add('connected');
        DOM.networkStatusText.textContent = 'Conectado';
        DOM.walletInfo.style.display = 'flex';
        DOM.connectWallet.style.display = 'none';
        DOM.walletAddress.textContent = shortAddress(address);
    } else {
        DOM.networkStatus.classList.remove('connected');
        DOM.networkStatus.classList.add('disconnected');
        DOM.networkStatusText.textContent = 'Desconectado';
        DOM.walletInfo.style.display = 'none';
        DOM.connectWallet.style.display = 'flex';
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

// ================ CONFIGURACIÓN DE RED Y CONTRATO ================
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

// ================ FUNCIONES DEL CONTRATO ================

// ---- Funciones de Lectura ----
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
        
        // Actualizar balances y estados
        DOM.tokenBalance.textContent = `${web3.utils.fromWei(balance, 'ether')} GO`;
        DOM.totalSupply.textContent = `${web3.utils.fromWei(supply, 'ether')} GO`;
        updateContractStatusUI(paused);
        updateWalletStatusUI(walletPaused);
        
        // Verificar roles
        isOwner = userAddress.toLowerCase() === owner.toLowerCase();
        isAuxiliary = userAddress.toLowerCase() === auxiliary.toLowerCase();
        toggleRoleSections();
        
        // Actualizar datos de recovery
        updateRecoveryUI(recoveryData);
        updateAuxiliaryUI(auxiliary);
        
    } catch (error) {
        handleError(error, "Error cargando datos");
    } finally {
        hideLoader();
    }
}

function updateContractStatusUI(paused) {
    DOM.contractPausedStatus.textContent = paused ? '⛔ PAUSADO' : '✅ Activo';
    DOM.contractPausedStatus.className = paused ? 'status-badge paused' : 'status-badge active';
}

function updateWalletStatusUI(paused) {
    DOM.walletPausedStatus.textContent = paused ? '⛔ PAUSADA' : '✅ Activa';
    DOM.walletPausedStatus.className = paused ? 'status-badge paused' : 'status-badge active';
}

function updateRecoveryUI({nominee, deadline, approved, remainingTime}) {
    // Actualizar datos básicos
    DOM.recoveryNominee.textContent = nominee === '0x0000000000000000000000000000000000000000' 
        ? 'Ninguno' 
        : shortAddress(nominee);
    
    DOM.recoveryDeadline.textContent = deadline === '0' 
        ? 'N/A' 
        : new Date(deadline * 1000).toLocaleString();
    
    DOM.recoveryApproved.textContent = approved ? '✅ Aprobado' : '❌ No aprobado';
    
    // Actualizar tiempo restante con estilos dinámicos
    if (remainingTime > 0) {
        const days = Math.floor(remainingTime / 86400);
        const hours = Math.floor((remainingTime % 86400) / 3600);
        DOM.recoveryRemainingTime.textContent = `${days}d ${hours}h`;
        
        // Cambiar estilo según tiempo restante
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

function updateAuxiliaryUI(auxiliary) {
    DOM.auxiliaryAddress.textContent = auxiliary === '0x0000000000000000000000000000000000000000' 
        ? 'No asignado' 
        : shortAddress(auxiliary);
}

function toggleRoleSections() {
    DOM.ownerSection.style.display = isOwner ? 'block' : 'none';
    DOM.auxiliarySection.style.display = isAuxiliary ? 'block' : 'none';
}

// ---- Funciones de Escritura ----
async function transferTokens() {
    try {
        const recipient = DOM.recipientAddress.value;
        const amount = DOM.transferAmount.value;
        
        validateAddress(recipient);
        validateAmount(amount);
        
        showLoader("Enviando transacción...");
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

// ---- Sistema de Ownership ----
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
    DOM.connectWallet.addEventListener('click', connectWallet);
    DOM.disconnectWallet.addEventListener('click', disconnectWallet);
    DOM.refreshBalance.addEventListener('click', loadInitialData);
    
    // Transferencias
    DOM.transferTokens.addEventListener('click', transferTokens);
    DOM.burnTokens.addEventListener('click', burnTokens);
    
    // Seguridad
    DOM.pauseWallet.addEventListener('click', () => toggleWalletPause(true));
    DOM.unpauseWallet.addEventListener('click', () => toggleWalletPause(false));
    
    // Owner functions
    DOM.mintTokens.addEventListener('click', mintTokens);
    DOM.pauseContract.addEventListener('click', () => toggleContractPause(true));
    DOM.unpauseContract.addEventListener('click', () => toggleContractPause(false));
    DOM.setAuxiliaryBtn.addEventListener('click', setAuxiliaryOwner);
    
    // Recovery
    DOM.approveRecoveryBtn.addEventListener('click', () => approveRecovery(true));
    DOM.executeRecoveryBtn.addEventListener('click', executeRecovery);
    DOM.claimOwnershipBtn.addEventListener('click', claimOwnership);
}

function detectProvider() {
    if (window.ethereum) {
        // Manejar múltiples proveedores
        if (window.ethereum.providers) {
            return window.ethereum.providers.find(p => p.isMetaMask) || window.ethereum;
        }
        return window.ethereum;
    }
    
    // Soporte para versiones antiguas
    if (window.web3?.currentProvider?.isMetaMask) {
        return window.web3.currentProvider;
    }
    
    return null;
}

function showMetaMaskModal() {
    // Implementar lógica para mostrar modal que indique instalar MetaMask
    showNotification("Por favor instala MetaMask para continuar", "error");
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
    // Resetear estado de la aplicación
    userAddress = null;
    isOwner = false;
    isAuxiliary = false;
    
    // Resetear UI
    DOM.tokenBalance.textContent = "0.00 GO";
    DOM.totalSupply.textContent = "-";
    DOM.contractPausedStatus.textContent = "-";
    DOM.walletPausedStatus.textContent = "-";
    DOM.ownerSection.style.display = 'none';
    DOM.auxiliarySection.style.display = 'none';
}

// ================ MANEJO DE UI ================
function showLoader(message = "Procesando...") {
    DOM.loaderText.textContent = message;
    DOM.loader.style.display = 'flex';
}

function hideLoader() {
    DOM.loader.style.display = 'none';
}

function showNotification(message, type = "success") {
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
        message = "Wallet pausada - no se puede realizar la operación";
    } else if (error.message.includes("contract paused")) {
        message = "Contrato pausado - operación no disponible";
    }
    
    showNotification(`${context}: ${message}`, "error");
}
