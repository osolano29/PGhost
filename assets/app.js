// ================ CONFIGURACIÓN ================
import { CONTRACT_CONFIG, AMOY_CONFIG } from './ghost-token.js';

// Variables globales
let web3, contract, userAddress, isOwner = false, isAuxiliary = false;

// Elementos del DOM
const DOM = {
    // Conexión
    connectBtn: document.getElementById('connectWallet'),
    disconnectBtn: document.getElementById('disconnectWallet'),
    walletStatus: document.getElementById('networkStatusText'),
    walletInfo: document.getElementById('walletInfo'),
    walletAddress: document.getElementById('walletAddress'),
    networkStatus: document.getElementById('networkStatus'),
    copyWalletAddress: document.getElementById('copyWalletAddress'),
    copyContractAddress: document.getElementById('copyContractAddress'),
    contractAddressShort: document.getElementById('contractAddressShort'),
    
    // Tokens
    tokenBalance: document.getElementById('tokenBalance'),
    totalSupply: document.getElementById('totalSupply'),
    contractStatus: document.getElementById('contractPausedStatus'),
    walletStatusIndicator: document.getElementById('walletPausedStatus'),
    refreshBalance: document.getElementById('refreshBalance'),
    
    // Transferencias
    recipientAddress: document.getElementById('recipientAddress'),
    transferAmount: document.getElementById('transferAmount'),
    transferBtn: document.getElementById('transferTokens'),
    estimateTransferGas: document.getElementById('estimateTransferGas'),
    transferGasEstimate: document.getElementById('transferGasEstimate'),
    transferGasUsed: document.getElementById('transferGasUsed'),
    
    // Mint/Burn
    mintAddress: document.getElementById('mintAddress'),
    mintAmount: document.getElementById('mintAmount'),
    mintBtn: document.getElementById('mintTokens'),
    estimateMintGas: document.getElementById('estimateMintGas'),
    mintGasEstimate: document.getElementById('mintGasEstimate'),
    mintGasUsed: document.getElementById('mintGasUsed'),
    burnAmount: document.getElementById('burnAmount'),
    burnBtn: document.getElementById('burnTokens'),
    estimateBurnGas: document.getElementById('estimateBurnGas'),
    burnGasEstimate: document.getElementById('burnGasEstimate'),
    burnGasUsed: document.getElementById('burnGasUsed'),
    
    // Pausas
    pauseWalletBtn: document.getElementById('pauseWallet'),
    unpauseWalletBtn: document.getElementById('unpauseWallet'),
    pauseContractBtn: document.getElementById('pauseContract'),
    unpauseContractBtn: document.getElementById('unpauseContract'),
    
    // Auxiliar
    newAuxiliary: document.getElementById('newAuxiliary'),
    setAuxiliaryBtn: document.getElementById('setAuxiliaryBtn'),
    claimOwnershipBtn: document.getElementById('claimOwnershipBtn'),
    auxiliaryAddress: document.getElementById('auxiliaryAddress'),
    
    // UI
    loader: document.getElementById('loader'),
    loaderText: document.getElementById('loaderText'),
    notification: document.getElementById('notification'),
    notificationMessage: document.getElementById('notificationMessage'),
    ownerSection: document.getElementById('ownerSection'),
    auxiliarySection: document.getElementById('auxiliarySection'),
    metaMaskModal: document.getElementById('metaMaskModal')
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
        showLoader("Conectando wallet...");
        
        // 1. Detección de MetaMask
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
        
        const [balance, supply, paused, walletPaused, auxiliary] = await Promise.all([
            contract.methods.balanceOf(userAddress).call(),
            contract.methods.totalSupply().call(),
            contract.methods.paused().call(),
            contract.methods.isWalletPaused(userAddress).call(),
            contract.methods.auxiliaryOwner().call()
        ]);
        
        // Actualizar UI con los datos
        DOM.tokenBalance.textContent = `${fromWei(balance)} GO`;
        DOM.totalSupply.textContent = `${fromWei(supply)} GO`;
        DOM.contractStatus.textContent = paused ? '⛔ PAUSADO' : '✅ Activo';
        DOM.walletStatusIndicator.textContent = walletPaused ? '⛔ PAUSADA' : '✅ Activa';
        DOM.auxiliaryAddress.textContent = auxiliary === '0x0000000000000000000000000000000000000000' ? 'No asignado' : shortAddress(auxiliary);
        
        // Verificar roles
        const owner = await contract.methods.owner().call();
        isOwner = userAddress.toLowerCase() === owner.toLowerCase();
        isAuxiliary = userAddress.toLowerCase() === auxiliary.toLowerCase();
        
        toggleRoleSections();
        
    } catch (error) {
        handleError(error, "Error cargando datos iniciales");
    } finally {
        hideLoader();
    }
}

// ================ TRANSACCIONES ================
async function estimateTransactionGas(methodName, args = [], estimateElementId = null) {
    try {
        if (!userAddress) {
            showNotification("Conecta tu wallet primero", "error");
            return null;
        }

        showLoader("Estimando gas...");
        const gasEstimate = await contract.methods[methodName](...args)
            .estimateGas({ from: userAddress });
        
        if (estimateElementId && DOM[estimateElementId]) {
            DOM[estimateElementId].textContent = gasEstimate;
        }
        
        return gasEstimate;
    } catch (error) {
        handleError(error, "Error estimando gas");
        return null;
    } finally {
        hideLoader();
    }
}

function showGasUsed(tx, usedElementId) {
    if (tx && tx.gasUsed && DOM[usedElementId]) {
        DOM[usedElementId].textContent = tx.gasUsed;
    }
}

async function transferTokens() {
    try {
        const recipient = DOM.recipientAddress.value;
        const amount = DOM.transferAmount.value;
        
        validateAddress(recipient);
        validateAmount(amount);
        
        const gasEstimate = await estimateTransactionGas(
            'transfer',
            [recipient, toWei(amount)],
            'transferGasEstimate'
        );
        
        if (!gasEstimate) return;

        showLoader("Enviando transferencia...");
        const tx = await contract.methods.transfer(recipient, toWei(amount))
            .send({ from: userAddress, gas: Math.floor(gasEstimate * 1.2) });
        
        showGasUsed(tx, 'transferGasUsed');
        showNotification(`Transferencia exitosa! Gas usado: ${tx.gasUsed}`, "success");
        await loadInitialData();
        
    } catch (error) {
        if (error.receipt) {
            showGasUsed(error.receipt, 'transferGasUsed');
            handleError(error, `Error en transferencia (Gas usado: ${error.receipt.gasUsed})`);
        } else {
            handleError(error, "Error en transferencia");
        }
    } finally {
        hideLoader();
    }
}

async function burnTokens() {
    try {
        const amount = DOM.burnAmount.value;
        validateAmount(amount);
        
        const gasEstimate = await estimateTransactionGas(
            'burn',
            [toWei(amount)],
            'burnGasEstimate'
        );
        
        if (!gasEstimate) return;

        showLoader("Procesando quema...");
        const tx = await contract.methods.burn(toWei(amount))
            .send({ from: userAddress, gas: Math.floor(gasEstimate * 1.2) });
        
        showGasUsed(tx, 'burnGasUsed');
        showNotification(`Tokens quemados exitosamente! Gas usado: ${tx.gasUsed}`, "success");
        await loadInitialData();
        
    } catch (error) {
        if (error.receipt) {
            showGasUsed(error.receipt, 'burnGasUsed');
            handleError(error, `Error quemando tokens (Gas usado: ${error.receipt.gasUsed})`);
        } else {
            handleError(error, "Error quemando tokens");
        }
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
        
        const gasEstimate = await estimateTransactionGas(
            'mint',
            [recipient, toWei(amount)],
            'mintGasEstimate'
        );
        
        if (!gasEstimate) return;

        showLoader("Minteando tokens...");
        const tx = await contract.methods.mint(recipient, toWei(amount))
            .send({ from: userAddress, gas: Math.floor(gasEstimate * 1.2) });
        
        showGasUsed(tx, 'mintGasUsed');
        showNotification(`Tokens minteados exitosamente! Gas usado: ${tx.gasUsed}`, "success");
        await loadInitialData();
        
    } catch (error) {
        if (error.receipt) {
            showGasUsed(error.receipt, 'mintGasUsed');
            handleError(error, `Error minteando tokens (Gas usado: ${error.receipt.gasUsed})`);
        } else {
            handleError(error, "Error minteando tokens");
        }
    } finally {
        hideLoader();
    }
}

async function toggleWalletPause(pause) {
    try {
        const method = pause ? 'pauseMyWallet' : 'unpauseMyWallet';
        const estimateElementId = pause ? 'pauseWalletGasEstimate' : 'unpauseWalletGasEstimate';
        const usedElementId = pause ? 'pauseWalletGasUsed' : 'unpauseWalletGasUsed';
        
        const gasEstimate = await estimateTransactionGas(method, [], estimateElementId);
        if (!gasEstimate) return;

        showLoader(pause ? "Pausando wallet..." : "Reanudando wallet...");
        const tx = await contract.methods[method]()
            .send({ from: userAddress, gas: Math.floor(gasEstimate * 1.2) });
        
        showGasUsed(tx, usedElementId);
        showNotification(
            `Wallet ${pause ? "pausada" : "reanudada"} correctamente! Gas usado: ${tx.gasUsed}`, 
            "success"
        );
        await loadInitialData();
        
    } catch (error) {
        if (error.receipt) {
            const usedElementId = pause ? 'pauseWalletGasUsed' : 'unpauseWalletGasUsed';
            showGasUsed(error.receipt, usedElementId);
            handleError(error, `Error ${pause ? "pausando" : "reanudando"} wallet (Gas usado: ${error.receipt.gasUsed})`);
        } else {
            handleError(error, pause ? "Error pausando wallet" : "Error reanudando wallet");
        }
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
        const estimateElementId = pause ? 'pauseGasEstimate' : 'unpauseGasEstimate';
        const usedElementId = pause ? 'pauseGasUsed' : 'unpauseGasUsed';
        
        const gasEstimate = await estimateTransactionGas(method, [], estimateElementId);
        if (!gasEstimate) return;

        showLoader(pause ? "Pausando contrato..." : "Reanudando contrato...");
        const tx = await contract.methods[method]()
            .send({ from: userAddress, gas: Math.floor(gasEstimate * 1.2) });
        
        showGasUsed(tx, usedElementId);
        showNotification(
            `Contrato ${pause ? "pausado" : "reanudado"} correctamente! Gas usado: ${tx.gasUsed}`, 
            "success"
        );
        await loadInitialData();
        
    } catch (error) {
        if (error.receipt) {
            const usedElementId = pause ? 'pauseGasUsed' : 'unpauseGasUsed';
            showGasUsed(error.receipt, usedElementId);
            handleError(error, `Error ${pause ? "pausando" : "reanudando"} contrato (Gas usado: ${error.receipt.gasUsed})`);
        } else {
            handleError(error, pause ? "Error pausando contrato" : "Error reanudando contrato");
        }
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
        
        const gasEstimate = await estimateTransactionGas(
            'setAuxiliaryOwner',
            [newAuxiliary],
            'auxiliaryGasEstimate'
        );
        
        if (!gasEstimate) return;

        showLoader("Actualizando auxiliar...");
        const tx = await contract.methods.setAuxiliaryOwner(newAuxiliary)
            .send({ from: userAddress, gas: Math.floor(gasEstimate * 1.2) });
        
        showGasUsed(tx, 'auxiliaryGasUsed');
        showNotification(`Auxiliar actualizado correctamente! Gas usado: ${tx.gasUsed}`, "success");
        await loadInitialData();
        
    } catch (error) {
        if (error.receipt) {
            showGasUsed(error.receipt, 'auxiliaryGasUsed');
            handleError(error, `Error asignando auxiliar (Gas usado: ${error.receipt.gasUsed})`);
        } else {
            handleError(error, "Error asignando auxiliar");
        }
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
        const gasEstimate = await estimateTransactionGas(
            'claimOwnershipFromAuxiliary',
            [],
            'auxiliaryGasEstimate'
        );
        
        if (!gasEstimate) return;

        showLoader("Iniciando proceso de recovery...");
        const tx = await contract.methods.claimOwnershipFromAuxiliary()
            .send({ from: userAddress, gas: Math.floor(gasEstimate * 1.2) });
        
        showGasUsed(tx, 'auxiliaryGasUsed');
        showNotification(`Proceso de recovery iniciado! Gas usado: ${tx.gasUsed}`, "success");
        await loadInitialData();
        
    } catch (error) {
        if (error.receipt) {
            showGasUsed(error.receipt, 'auxiliaryGasUsed');
            handleError(error, `Error iniciando recovery (Gas usado: ${error.receipt.gasUsed})`);
        } else {
            handleError(error, "Error iniciando recovery");
        }
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
        // Estado conectado
        DOM.walletStatus.textContent = shortAddress(userAddress);
        DOM.networkStatus.className = 'connection-status-badge connected';
        DOM.walletInfo.style.display = 'flex';
        DOM.walletAddress.textContent = shortAddress(userAddress);
        DOM.connectBtn.style.display = 'none';
        DOM.disconnectBtn.style.display = 'block';
    } else {
        // Estado desconectado
        DOM.walletStatus.textContent = 'Desconectado';
        DOM.networkStatus.className = 'connection-status-badge disconnected';
        DOM.walletInfo.style.display = 'none';
        DOM.connectBtn.style.display = 'block';
        DOM.disconnectBtn.style.display = 'none';
    }
    
    toggleRoleSections();
}

function toggleRoleSections() {
    DOM.ownerSection.style.display = isOwner ? 'block' : 'none';
    DOM.auxiliarySection.style.display = isAuxiliary ? 'block' : 'none';
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

function showLoader(message = "") {
    DOM.loader.style.display = 'flex';
    if (message && DOM.loaderText) {
        DOM.loaderText.textContent = message;
    }
}

function hideLoader() {
    DOM.loader.style.display = 'none';
}

function showNotification(message, type = "success") {
    DOM.notificationMessage.textContent = message;
    DOM.notification.className = `notification ${type}`;
    DOM.notification.style.display = 'block';
    
    setTimeout(() => {
        DOM.notification.style.display = 'none';
    }, 5000);
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

function detectProvider() {
    if (window.ethereum) {
        if (window.ethereum.providers) {
            return window.ethereum.providers.find(p => p.isMetaMask) || window.ethereum;
        }
        return window.ethereum;
    }
    
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
    } catch (error) {
        handleError(error, "Error configurando red");
    }
}

function initContract() {
    if (!CONTRACT_CONFIG.networks["80002"]?.address) {
        throw new Error("Dirección del contrato no configurada para Amoy");
    }
    
    contract = new web3.eth.Contract(
        CONTRACT_CONFIG.abi,
        CONTRACT_CONFIG.networks["80002"].address
    );
    
    // Mostrar versión abreviada en UI
    DOM.contractAddressShort.textContent = shortAddress(CONTRACT_CONFIG.networks["80002"].address);
    
    // Guardar dirección completa en dataset
    DOM.contractAddressShort.dataset.fullAddress = CONTRACT_CONFIG.networks["80002"].address;
}

function showMetaMaskModal() {
    DOM.metaMaskModal.style.display = 'block';
    const closeBtn = DOM.metaMaskModal.querySelector('.close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            DOM.metaMaskModal.style.display = 'none';
        });
    }
}

function setupEventListeners() {
    // Conexión
    DOM.connectBtn.addEventListener('click', connectWallet);
    DOM.disconnectBtn.addEventListener('click', disconnectWallet);
    DOM.refreshBalance.addEventListener('click', loadInitialData);
    
    // Copiar dirección de wallet
    DOM.copyWalletAddress.addEventListener('click', () => {
        navigator.clipboard.writeText(userAddress)
            .then(() => {
                showNotification("¡Dirección copiada al portapapeles!", "success");
            })
            .catch(err => {
                console.error('Error al copiar: ', err);
                showNotification("Error al copiar la dirección", "error");
            });
    });
    // Copiar dirección completa del contrato
DOM.copyContractAddress.addEventListener('click', () => {
    // Obtener la dirección completa de CONTRACT_CONFIG si no está en dataset
    const fullAddress = DOM.contractAddressShort.dataset.fullAddress || 
                       CONTRACT_CONFIG.networks["80002"].address;
    
    if (!fullAddress) {
        showNotification("Dirección del contrato no disponible", "error");
        return;
    }

    navigator.clipboard.writeText(fullAddress)
        .then(() => {
            showNotification("¡Dirección completa copiada!", "success");
        })
        .catch(err => {
            console.error('Error al copiar:', err);
            showNotification("Error al copiar dirección", "error");
        });
});
    
    // Transferencias
    DOM.transferBtn.addEventListener('click', transferTokens);
    DOM.estimateTransferGas.addEventListener('click', () => 
        estimateTransactionGas(
            'transfer',
            [DOM.recipientAddress.value, toWei(DOM.transferAmount.value)],
            'transferGasEstimate'
        )
    );
    
    // Quemado
    DOM.burnBtn.addEventListener('click', burnTokens);
    DOM.estimateBurnGas.addEventListener('click', () => 
        estimateTransactionGas(
            'burn',
            [toWei(DOM.burnAmount.value)],
            'burnGasEstimate'
        )
    );
    
    // Seguridad
    DOM.pauseWalletBtn.addEventListener('click', () => toggleWalletPause(true));
    DOM.unpauseWalletBtn.addEventListener('click', () => toggleWalletPause(false));
    
    // Owner functions
    DOM.mintBtn.addEventListener('click', mintTokens);
    DOM.estimateMintGas.addEventListener('click', () => 
        estimateTransactionGas(
            'mint',
            [DOM.mintAddress.value, toWei(DOM.mintAmount.value)],
            'mintGasEstimate'
        )
    );
    
    DOM.pauseContractBtn.addEventListener('click', () => toggleContractPause(true));
    DOM.unpauseContractBtn.addEventListener('click', () => toggleContractPause(false));
    
    // Auxiliar
    DOM.setAuxiliaryBtn.addEventListener('click', setAuxiliaryOwner);
    DOM.claimOwnershipBtn.addEventListener('click', claimOwnership);
}

// Inicialización
if (document.readyState !== 'loading') {
    initApp();
} else {
    document.addEventListener('DOMContentLoaded', initApp);
}
