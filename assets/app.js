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
    loader: document.getElementById('loader'),
    
    // Nuevos elementos para estimación de gas
    recipientAddress: document.getElementById('recipientAddress'),
    transferAmount: document.getElementById('transferAmount'),
    mintAddress: document.getElementById('mintAddress'),
    mintAmount: document.getElementById('mintAmount'),
    burnAmount: document.getElementById('burnAmount'),
    newAuxiliary: document.getElementById('newAuxiliary'),
    notification: document.getElementById('notification'),
    notificationMessage: document.getElementById('notificationMessage')
};

// ================ FUNCIONES DE UTILIDAD ================

/**
 * Convierte una cantidad a wei (18 decimales)
 * @param {string|number} amount - Cantidad a convertir
 * @returns {string} - Cantidad en wei
 */
function toWei(amount) {
    return web3.utils.toWei(amount.toString(), 'ether');
}

/**
 * Convierte una cantidad de wei a unidades estándar
 * @param {string|number} amount - Cantidad en wei
 * @returns {string} - Cantidad en unidades estándar
 */
function fromWei(amount) {
    return web3.utils.fromWei(amount.toString(), 'ether');
}

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
        showLoader("Conectando wallet...");
        
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
        showLoader("Cargando datos...");
        
        const [balance, supply, paused, walletPaused, auxiliary, recovery] = await Promise.all([
            contract.methods.balanceOf(userAddress).call(),
            contract.methods.totalSupply().call(),
            contract.methods.paused().call(),
            contract.methods.isWalletPaused(userAddress).call(),
            contract.methods.auxiliaryOwner().call(),
            contract.methods.recoveryStatus().call()
        ]);
        
        // Actualizar UI con los datos
        DOM.tokenBalance.textContent = `${fromWei(balance)} GO`;
        DOM.totalSupply.textContent = `${fromWei(supply)} GO`;
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
    } finally {
        hideLoader();
    }
}

// ---- Funciones de Escritura ----

/**
 * Función genérica para estimar gas
 * @param {string} methodName - Nombre del método del contrato
 * @param {array} args - Argumentos para la función
 * @returns {Promise<number>} - Estimación de gas
 */
async function estimateTransactionGas(methodName, args = []) {
    try {
        if (!userAddress) {
            showNotification("Conecta tu wallet primero", "error");
            return null;
        }

        showLoader("Estimando gas...");
        const gasEstimate = await contract.methods[methodName](...args)
            .estimateGas({ from: userAddress });
        
        return gasEstimate;
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
        
        // Estimar gas
        const gasEstimate = await estimateTransactionGas(
            'transfer',
            [recipient, toWei(amount)]
        );
        
        if (!gasEstimate) return;

        showLoader("Enviando transferencia...");
        const tx = await contract.methods.transfer(
            recipient, 
            toWei(amount)
        ).send({ 
            from: userAddress,
            gas: Math.floor(gasEstimate * 1.2) // 20% más por seguridad
        });
        
        showNotification(`Transferencia exitosa! Gas usado: ${tx.gasUsed}`, "success");
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
        
        // Estimar gas
        const gasEstimate = await estimateTransactionGas(
            'burn',
            [toWei(amount)]
        );
        
        if (!gasEstimate) return;

        showLoader("Procesando quema...");
        const tx = await contract.methods.burn(
            toWei(amount)
        ).send({ 
            from: userAddress,
            gas: Math.floor(gasEstimate * 1.2)
        });
        
        showNotification(`Tokens quemados exitosamente! Gas usado: ${tx.gasUsed}`, "success");
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
        
        // Estimar gas
        const gasEstimate = await estimateTransactionGas(
            'mint',
            [recipient, toWei(amount)]
        );
        
        if (!gasEstimate) return;

        showLoader("Minteando tokens...");
        const tx = await contract.methods.mint(
            recipient,
            toWei(amount)
        ).send({ 
            from: userAddress,
            gas: Math.floor(gasEstimate * 1.2)
        });
        
        showNotification(`Tokens minteados exitosamente! Gas usado: ${tx.gasUsed}`, "success");
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
        const method = pause ? 'pauseMyWallet' : 'unpauseMyWallet';
        
        // Estimar gas
        const gasEstimate = await estimateTransactionGas(method, []);
        if (!gasEstimate) return;

        showLoader(pause ? "Pausando wallet..." : "Reanudando wallet...");
        const tx = await contract.methods[method]().send({ 
            from: userAddress,
            gas: Math.floor(gasEstimate * 1.2)
        });
        
        showNotification(
            `Wallet ${pause ? "pausada" : "reanudada"} correctamente! Gas usado: ${tx.gasUsed}`, 
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
        const method = pause ? 'pause' : 'unpause';
        
        // Estimar gas
        const gasEstimate = await estimateTransactionGas(method, []);
        if (!gasEstimate) return;

        showLoader(pause ? "Pausando contrato..." : "Reanudando contrato...");
        const tx = await contract.methods[method]().send({ 
            from: userAddress,
            gas: Math.floor(gasEstimate * 1.2)
        });
        
        showNotification(
            `Contrato ${pause ? "pausado" : "reanudado"} correctamente! Gas usado: ${tx.gasUsed}`, 
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
        
        // Estimar gas
        const gasEstimate = await estimateTransactionGas(
            'setAuxiliaryOwner',
            [newAuxiliary]
        );
        
        if (!gasEstimate) return;

        showLoader("Actualizando auxiliar...");
        const tx = await contract.methods.setAuxiliaryOwner(newAuxiliary)
            .send({ 
                from: userAddress,
                gas: Math.floor(gasEstimate * 1.2)
            });
        
        showNotification(`Auxiliar actualizado correctamente! Gas usado: ${tx.gasUsed}`, "success");
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
        // Estimar gas
        const gasEstimate = await estimateTransactionGas(
            'approveRecovery',
            [approve]
        );
        
        if (!gasEstimate) return;

        showLoader(approve ? "Aprobando recovery..." : "Rechazando recovery...");
        const tx = await contract.methods.approveRecovery(approve)
            .send({ 
                from: userAddress,
                gas: Math.floor(gasEstimate * 1.2)
            });
        
        showNotification(
            `Recovery ${approve ? "aprobado" : "rechazado"} correctamente! Gas usado: ${tx.gasUsed}`, 
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
        // Estimar gas
        const gasEstimate = await estimateTransactionGas(
            'executeRecovery',
            []
        );
        
        if (!gasEstimate) return;

        showLoader("Ejecutando recovery...");
        const tx = await contract.methods.executeRecovery()
            .send({ 
                from: userAddress,
                gas: Math.floor(gasEstimate * 1.2)
            });
        
        showNotification(`¡Ownership transferido exitosamente! Gas usado: ${tx.gasUsed}`, "success");
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
        // Estimar gas
        const gasEstimate = await estimateTransactionGas(
            'claimOwnershipFromAuxiliary',
            []
        );
        
        if (!gasEstimate) return;

        showLoader("Iniciando proceso de recovery...");
        const tx = await contract.methods.claimOwnershipFromAuxiliary()
            .send({ 
                from: userAddress,
                gas: Math.floor(gasEstimate * 1.2)
            });
        
        showNotification(`Proceso de recovery iniciado! Gas usado: ${tx.gasUsed}`, "success");
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

function showMetaMaskModal() {
    // Implementar lógica para mostrar modal de instalación de MetaMask
    console.warn("MetaMask no detectado");
}

function showNotification(message, type = "success") {
    if (DOM.notification && DOM.notificationMessage) {
        DOM.notificationMessage.textContent = message;
        DOM.notification.className = `notification ${type}`;
        DOM.notification.style.display = 'block';
        
        setTimeout(() => {
            DOM.notification.style.display = 'none';
        }, 5000);
    } else {
        alert(message);
    }
}

// ================ UTILIDADES ================
function setupEventListeners() {
    // Conexión y operaciones básicas
    DOM.connectBtn.addEventListener('click', connectWallet);
    DOM.transferBtn.addEventListener('click', transferTokens);
    DOM.burnBtn.addEventListener('click', burnTokens);
    DOM.pauseWalletBtn.addEventListener('click', () => toggleWalletPause(true));
    DOM.unpauseWalletBtn.addEventListener('click', () => toggleWalletPause(false));
    
    // Funciones de owner
    if (DOM.mintBtn) DOM.mintBtn.addEventListener('click', mintTokens);
    if (DOM.pauseContractBtn) DOM.pauseContractBtn.addEventListener('click', () => toggleContractPause(true));
    if (DOM.unpauseContractBtn) DOM.unpauseContractBtn.addEventListener('click', () => toggleContractPause(false));
    if (DOM.setAuxiliaryBtn) DOM.setAuxiliaryBtn.addEventListener('click', setAuxiliaryOwner);
    if (DOM.approveRecoveryBtn) DOM.approveRecoveryBtn.addEventListener('click', () => approveRecovery(true));
    
    // Funciones de auxiliar
    if (DOM.claimOwnershipBtn) DOM.claimOwnershipBtn.addEventListener('click', claimOwnership);
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

function handleError(error, context = "") {
    console.error(context, error);
    
    let message = error.message;
    if (error.code === 4001) message = "Cancelado por el usuario";
    else if (error.message.includes("user denied transaction")) message = "Transacción rechazada";
    else if (error.message.includes("insufficient funds")) message = "Fondos insuficientes para gas";
    
    showNotification(`${context}: ${message}`, "error");
}

function shortAddress(address) {
    return address ? `${address.substring(0, 6)}...${address.substring(38)}` : "N/A";
}

function showLoader(message = "") {
    if (DOM.loader) {
        DOM.loader.style.display = 'flex';
        if (message && DOM.loaderText) {
            DOM.loaderText.textContent = message;
        }
    }
}

function hideLoader() {
    if (DOM.loader) {
        DOM.loader.style.display = 'none';
    }
}

function updateUI() {
    DOM.walletStatus.innerHTML = `<span>Conectado: ${shortAddress(userAddress)}</span>`;
    if (DOM.connectBtn) {
        DOM.connectBtn.disabled = true;
        DOM.connectBtn.innerHTML = `<i class="fas fa-check-circle"></i> Conectado`;
    }
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
        } else {
            // Wallet desconectada
            userAddress = null;
            isOwner = false;
            isAuxiliary = false;
            updateUI();
        }
    });
    
    window.ethereum.on('chainChanged', () => window.location.reload());
}
