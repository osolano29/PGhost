// ================ CONFIGURACIÓN ================
import { CONTRACT_CONFIG, AMOY_CONFIG } from './ghost-token.js';

// Variables globales
let web3, contract, userAddress, isOwner = false, isAuxiliary = false;

// Elementos del DOM
const DOM = {
    // Conexión
    connectBtn: document.getElementById('connectWallet'),
    disconnectBtn: document.getElementById('disconnectWallet'),
    walletStatus: document.getElementById('walletStatus'),
    copyAddressBtn: document.getElementById('copyAddress'),
    networkInfo: document.getElementById('networkInfo'),
    
    // Tokens
    tokenBalance: document.getElementById('tokenBalance'),
    totalSupply: document.getElementById('totalSupply'),
    contractStatus: document.getElementById('contractPausedStatus'),
    walletStatusIndicator: document.getElementById('walletPausedStatus'),
    
    // Transferencias
    recipientAddress: document.getElementById('recipientAddress'),
    transferAmount: document.getElementById('transferAmount'),
    transferBtn: document.getElementById('transferTokens'),
    
    // Mint/Burn
    mintAddress: document.getElementById('mintAddress'),
    mintAmount: document.getElementById('mintAmount'),
    mintBtn: document.getElementById('mintTokens'),
    burnAmount: document.getElementById('burnAmount'),
    burnBtn: document.getElementById('burnTokens'),
    
    // Pausas
    pauseWalletBtn: document.getElementById('pauseWallet'),
    unpauseWalletBtn: document.getElementById('unpauseWallet'),
    pauseContractBtn: document.getElementById('pauseContract'),
    unpauseContractBtn: document.getElementById('unpauseContract'),
    
    // Recovery
    newAuxiliary: document.getElementById('newAuxiliary'),
    setAuxiliaryBtn: document.getElementById('setAuxiliaryBtn'),
    claimOwnershipBtn: document.getElementById('claimOwnershipBtn'),
    approveRecoveryBtn: document.getElementById('approveRecoveryBtn'),
    executeRecoveryBtn: document.getElementById('executeRecoveryBtn'),
    recoveryNominee: document.getElementById('recoveryNominee'),
    recoveryDeadline: document.getElementById('recoveryDeadline'),
    recoveryApproved: document.getElementById('recoveryApproved'),
    
    // UI
    loader: document.getElementById('loader'),
    notification: document.getElementById('notification'),
    notificationMessage: document.getElementById('notificationMessage'),
    ownerSection: document.getElementById('ownerSection'),
    auxiliarySection: document.getElementById('auxiliarySection')
};

// ================ FUNCIONES PRINCIPALES ================
export async function initApp() {
    setupEventListeners();
    
    if (window.location.protocol === 'file:') {
        console.warn('Modo local detectado - Algunas funciones pueden estar limitadas');
    }
    
    if (window.ethereum?.selectedAddress) {
        await connectWallet();
    }
}

async function connectWallet() {
    try {
        showLoader("Conectando...");
        
        if (!window.ethereum) {
            showNotification("MetaMask no detectado", "error");
            return false;
        }

        web3 = new Web3(window.ethereum);
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        if (accounts.length === 0) {
            showNotification("Por favor, desbloquea MetaMask", "error");
            return false;
        }

        userAddress = accounts[0];
        await setupNetwork();
        initContract();
        await loadInitialData();
        
        updateUI();
        showNotification("¡Conectado correctamente!", "success");
        return true;
        
    } catch (error) {
        handleError(error, "Error al conectar");
        return false;
    } finally {
        hideLoader();
    }
}

async function disconnectWallet() {
    try {
        userAddress = null;
        isOwner = false;
        isAuxiliary = false;
        updateUI();
        showNotification("Wallet desconectada", "info");
    } catch (error) {
        handleError(error, "Error al desconectar");
    }
}

// ================ FUNCIONES DEL CONTRATO ================
async function loadInitialData() {
    try {
        showLoader("Cargando datos...");
        
        const [balance, supply, paused, walletPaused, auxiliary, recovery] = await Promise.all([
            contract.methods.balanceOf(userAddress).call(),
            contract.methods.totalSupply().call(),
            contract.methods.paused().call(),
            contract.methods.isWalletPaused(userAddress).call(),
            contract.methods.auxiliaryOwner().call(),
            contract.methods.recoveryStatus().call()
        ]);
        
        // Actualizar UI
        DOM.tokenBalance.textContent = `${fromWei(balance)} GO`;
        DOM.totalSupply.textContent = `${fromWei(supply)} GO`;
        DOM.contractStatus.textContent = paused ? '⛔ PAUSADO' : '✅ Activo';
        DOM.walletStatusIndicator.textContent = walletPaused ? '⛔ PAUSADA' : '✅ Activa';
        
        // Verificar roles
        const owner = await contract.methods.owner().call();
        isOwner = userAddress.toLowerCase() === owner.toLowerCase();
        isAuxiliary = userAddress.toLowerCase() === auxiliary.toLowerCase();
        
        toggleRoleSections();
        updateRecoveryUI(recovery);
        
    } catch (error) {
        handleError(error, "Error cargando datos");
    } finally {
        hideLoader();
    }
}

// ================ TRANSACCIONES ================
async function estimateTransactionGas(methodName, args = []) {
    try {
        if (!userAddress) {
            showNotification("Conecta tu wallet primero", "error");
            return null;
        }

        showLoader("Estimando gas...");
        return await contract.methods[methodName](...args)
            .estimateGas({ from: userAddress });
    } catch (error) {
        handleError(error, "Error estimando gas");
        return null;
    } finally {
        hideLoader();
    }
}

async function transferTokens() {
    try {
        const recipient = DOM.recipientAddress.value;
        const amount = DOM.transferAmount.value;
        
        validateAddress(recipient);
        validateAmount(amount);
        
        const gasEstimate = await estimateTransactionGas('transfer', [recipient, toWei(amount)]);
        if (!gasEstimate) return;

        showLoader("Enviando transferencia...");
        const tx = await contract.methods.transfer(recipient, toWei(amount))
            .send({ from: userAddress, gas: Math.floor(gasEstimate * 1.2) });
        
        showNotification(`Transferencia exitosa! Gas usado: ${tx.gasUsed}`, "success");
        await loadInitialData();
        
    } catch (error) {
        handleError(error, "Error en transferencia");
    } finally {
        hideLoader();
    }
}

// ================ UTILIDADES ================
function toWei(amount) {
    return web3.utils.toWei(amount.toString(), 'ether');
}

function fromWei(amount) {
    return web3.utils.fromWei(amount.toString(), 'ether');
}

function updateUI() {
    if (userAddress) {
        DOM.walletStatus.textContent = `Conectado: ${shortAddress(userAddress)}`;
        DOM.walletStatus.className = 'connected';
        DOM.connectBtn.style.display = 'none';
        DOM.disconnectBtn.style.display = 'block';
        if (DOM.copyAddressBtn) DOM.copyAddressBtn.style.display = 'block';
    } else {
        DOM.walletStatus.textContent = 'Desconectado';
        DOM.walletStatus.className = 'disconnected';
        DOM.connectBtn.style.display = 'block';
        DOM.disconnectBtn.style.display = 'none';
        if (DOM.copyAddressBtn) DOM.copyAddressBtn.style.display = 'none';
    }
    toggleRoleSections();
}

function setupEventListeners() {
    // Conexión
    DOM.connectBtn.addEventListener('click', connectWallet);
    DOM.disconnectBtn.addEventListener('click', disconnectWallet);
    
    if (DOM.copyAddressBtn) {
        DOM.copyAddressBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(userAddress);
            showNotification("¡Dirección copiada!", "success");
        });
    }
    
    // Transferencias
    DOM.transferBtn.addEventListener('click', transferTokens);
    
    // Otras funciones (mint, burn, etc.)
    // ... (implementa según necesidad)
}

// ================ INICIALIZACIÓN ================
document.addEventListener('DOMContentLoaded', initApp);

if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
            userAddress = accounts[0];
            updateUI();
            loadInitialData();
        } else {
            disconnectWallet();
        }
    });
    
    window.ethereum.on('chainChanged', () => window.location.reload());
}
