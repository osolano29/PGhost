// ================ CONFIGURACIÓN ================
// Importamos la configuración del contrato
import { CONTRACT_CONFIG, AMOY_CONFIG } from './ghost-token.js';

// Variables globales
let web3, contract, userAddress, isOwner = false, isAuxiliary = false;

// Elementos del DOM
const DOM = {
    connectBtn: document.getElementById('connectWallet'),
    transferBtn: document.getElementById('transferTokens'),
    burnBtn: document.getElementById('burnTokens'),
    mintBtn: document.getElementById('mintTokens'),
    pauseWalletBtn: document.getElementById('pauseWallet'),
    unpauseWalletBtn: document.getElementById('unpauseWallet'),
    pauseContractBtn: document.getElementById('pauseContract'),
    unpauseContractBtn: document.getElementById('unpauseContract'),
    setAuxiliaryBtn: document.getElementById('setAuxiliaryBtn'),
    claimOwnershipBtn: document.getElementById('claimOwnershipBtn'),
    approveRecoveryBtn: document.getElementById('approveRecoveryBtn'),
    executeRecoveryBtn: document.getElementById('executeRecoveryBtn'),
    toggleAllowanceBtn: document.getElementById('toggleAllowanceBtn'),
    walletStatus: document.getElementById('walletStatus'),
    networkInfo: document.getElementById('networkInfo'),
    tokenBalance: document.getElementById('tokenBalance'),
    totalSupply: document.getElementById('totalSupply'),
    contractStatus: document.getElementById('contractPausedStatus'),
    walletStatusIndicator: document.getElementById('walletPausedStatus'),
    auxiliaryAddress: document.getElementById('auxiliaryAddress'),
    recoveryNominee: document.getElementById('recoveryNominee'),
    recoveryDeadline: document.getElementById('recoveryDeadline'),
    recoveryApproved: document.getElementById('recoveryApproved'),
    loader: document.getElementById('loader')
};

// ================ FUNCIONES PRINCIPALES ================
export async function initApp() {
    setupEventListeners();
    
    // Solución para warning de postMessage en local
    if (window.location.protocol === 'file:') {
        console.warn('Modo local detectado - Algunas funciones pueden estar limitadas');
    }
    
    // Conexión automática si ya está conectado
    if (window.ethereum?.selectedAddress) {
        await connectWallet();
    }
}

async function connectWallet() {
    try {
        showLoader();
        
        // 1. Detección mejorada de MetaMask
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
        
        updateUI();
        return true;
        
    } catch (error) {
        handleError(error, "Error al conectar");
        return false;
    } finally {
        hideLoader();
    }
}

// ================ FUNCIONES DEL CONTRATO ================

// ---- Funciones de Lectura ----
async function loadInitialData() {
    try {
        const [balance, supply, paused, walletPaused, auxiliary, recovery] = await Promise.all([
            contract.methods.balanceOf(userAddress).call(),
            contract.methods.totalSupply().call(),
            contract.methods.paused().call(),
            contract.methods.isWalletPaused(userAddress).call(),
            contract.methods.auxiliaryOwner().call(),
            contract.methods.recoveryStatus().call()
        ]);
        
        // Actualizar UI con los datos
        DOM.tokenBalance.textContent = `${web3.utils.fromWei(balance, 'ether')} GO`;
        DOM.totalSupply.textContent = `${web3.utils.fromWei(supply, 'ether')} GO`;
        DOM.contractStatus.textContent = paused ? '⛔ PAUSADO' : '✅ Activo';
        DOM.walletStatusIndicator.textContent = walletPaused ? '⛔ PAUSADA' : '✅ Activa';
        
        // Verificar roles
        const owner = await contract.methods.owner().call();
        isOwner = userAddress.toLowerCase() === owner.toLowerCase();
        isAuxiliary = userAddress.toLowerCase() === auxiliary.toLowerCase();
        
        // Mostrar/ocultar funciones según roles
        toggleRoleSections();
        
        // Actualizar datos de recovery
        updateRecoveryUI(recovery);
        
    } catch (error) {
        handleError(error, "Error cargando datos iniciales");
    }
}

// ---- Funciones de Escritura ----
async function transferTokens() {
    try {
        const recipient = DOM.recipientAddress.value;
        const amount = DOM.transferAmount.value;
        
        validateAddress(recipient);
        validateAmount(amount);
        
        showLoader();
        const tx = await contract.methods.transfer(
            recipient, 
            web3.utils.toWei(amount, 'ether')
        ).send({ from: userAddress });
        
        showFeedback("Transferencia exitosa!");
        await loadInitialData();
        return tx;
        
    } catch (error) {
        handleError(error, "Error en transferencia");
    } finally {
        hideLoader();
    }
}

async function mintTokens() {
    if (!isOwner) {
        showFeedback("Solo el owner puede mintear tokens", "error");
        return;
    }
    
    try {
        const recipient = DOM.mintAddress.value;
        const amount = DOM.mintAmount.value;
        
        validateAddress(recipient);
        validateAmount(amount);
        
        showLoader();
        const tx = await contract.methods.mint(
            recipient,
            web3.utils.toWei(amount, 'ether')
        ).send({ from: userAddress });
        
        showFeedback("Tokens minteados exitosamente!");
        await loadInitialData();
        return tx;
        
    } catch (error) {
        handleError(error, "Error minteando tokens");
    } finally {
        hideLoader();
    }
}

// ---- Sistema de Ownership ----
async function setAuxiliaryOwner() {
    try {
        const newAuxiliary = DOM.newAuxiliary.value;
        validateAddress(newAuxiliary);
        
        showLoader();
        await contract.methods.setAuxiliaryOwner(newAuxiliary)
            .send({ from: userAddress });
        
        showFeedback("Auxiliar actualizado correctamente");
        await loadInitialData();
        
    } catch (error) {
        handleError(error, "Error asignando auxiliar");
    } finally {
        hideLoader();
    }
}

async function executeRecovery() {
    try {
        showLoader();
        await contract.methods.executeRecovery()
            .send({ from: userAddress });
        
        showFeedback("¡Ownership transferido exitosamente!");
        await loadInitialData();
        
    } catch (error) {
        handleError(error, "Error ejecutando recovery");
    } finally {
        hideLoader();
    }
}

// ================ FUNCIONES AUXILIARES ================
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

async function setupNetwork() {
    try {
        const chainId = await web3.eth.getChainId();
        if (chainId !== 80002) {
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
                } else {
                    throw new Error("Por favor cambia manualmente a Polygon Amoy");
                }
            }
        }
        DOM.networkInfo.innerHTML = `<span>Red: Polygon Amoy</span>`;
    } catch (error) {
        handleError(error, "Error configurando red");
    }
}

function initContract() {
    contract = new web3.eth.Contract(
        CONTRACT_CONFIG.abi,
        CONTRACT_CONFIG.networks["80002"].address
    );
}

function toggleRoleSections() {
    document.getElementById('ownerSection').style.display = isOwner ? 'block' : 'none';
    document.getElementById('auxiliarySection').style.display = isAuxiliary ? 'block' : 'none';
}

function updateRecoveryUI([nominee, deadline, approved]) {
    DOM.recoveryNominee.textContent = nominee === '0x0' ? 'Ninguno' : shortAddress(nominee);
    DOM.recoveryDeadline.textContent = deadline === '0' ? 'N/A' : new Date(deadline * 1000).toLocaleString();
    DOM.recoveryApproved.textContent = approved ? '✅ Aprobado' : '❌ No aprobado';
}

// ================ UTILIDADES ================
function setupEventListeners() {
    // Conexión y operaciones básicas
    DOM.connectBtn.addEventListener('click', connectWallet);
    DOM.transferBtn.addEventListener('click', transferTokens);
    DOM.burnBtn.addEventListener('click', burnTokens);
    
    // Funciones de owner
    if (DOM.mintBtn) DOM.mintBtn.addEventListener('click', mintTokens);
    if (DOM.pauseContractBtn) DOM.pauseContractBtn.addEventListener('click', () => togglePause(true));
    if (DOM.unpauseContractBtn) DOM.unpauseContractBtn.addEventListener('click', () => togglePause(false));
    
    // Funciones de auxiliar
    if (DOM.setAuxiliaryBtn) DOM.setAuxiliaryBtn.addEventListener('click', setAuxiliaryOwner);
    if (DOM.claimOwnershipBtn) DOM.claimOwnershipBtn.addEventListener('click', claimOwnership);
    
    // Recovery
    if (DOM.approveRecoveryBtn) DOM.approveRecoveryBtn.addEventListener('click', approveRecovery);
    if (DOM.executeRecoveryBtn) DOM.executeRecoveryBtn.addEventListener('click', executeRecovery);
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

function showFeedback(message, type = "success") {
    const feedbackEl = document.getElementById('feedback');
    if (feedbackEl) {
        feedbackEl.textContent = message;
        feedbackEl.className = `feedback ${type}`;
        setTimeout(() => feedbackEl.textContent = '', 5000);
    } else {
        alert(message);
    }
}

function handleError(error, context = "") {
    console.error(context, error);
    
    let message = error.message;
    if (error.code === 4001) message = "Cancelado por el usuario";
    else if (error.message.includes("user denied transaction")) message = "Transacción rechazada";
    else if (error.message.includes("insufficient funds")) message = "Fondos insuficientes para gas";
    
    showFeedback(`${context}: ${message}`, "error");
}

function shortAddress(address) {
    return address ? `${address.substring(0, 6)}...${address.substring(38)}` : "N/A";
}

function showLoader() {
    DOM.loader.style.display = 'flex';
}

function hideLoader() {
    DOM.loader.style.display = 'none';
}

function updateUI() {
    DOM.walletStatus.innerHTML = `<span>Conectado: ${shortAddress(userAddress)}</span>`;
    DOM.connectBtn.disabled = true;
    DOM.connectBtn.innerHTML = `<i class="fas fa-check-circle"></i> Conectado`;
}

// Inicialización
document.addEventListener('DOMContentLoaded', initApp);

// Manejo de cambios en la wallet
if (window.ethereum) {
    window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
            userAddress = accounts[0];
            updateUI();
            loadInitialData();
        }
    });
    
    window.ethereum.on('chainChanged', () => window.location.reload());
}
