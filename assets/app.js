// ================ CONFIGURACIÓN ================
import { CONTRACT_CONFIG, AMOY_CONFIG } from './ghost-token.js';

// Variables globales
let web3, contract, userAddress, isOwner = false, isAuxiliary = false;

// ================ UTILIDADES ================
// Añadir al inicio del archivo
const utils = {
    utils.showLoader: function(message = "") {
        if (DOM.loader) {
            DOM.loader.style.display = 'flex';
            if (message && DOM.loaderText) {
                DOM.loaderText.textContent = message;
            }
        }
    },
    hideLoader: function() {
        if (DOM.loader) {
            DOM.loader.style.display = 'none';
        }
    },
    toWei: function(amount) {
        if (!web3) throw new Error("Web3 no está inicializado");
        return web3.utils.toWei(amount.toString(), 'ether');
    },
    fromWei: function(amount) {
        if (!web3) throw new Error("Web3 no está inicializado");
        return web3.utils.fromWei(amount.toString(), 'ether');
    }
};

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
    metaMaskModal: document.getElementById('metaMaskModal'),
    
    // Configuración de Gas
    gasConfigPanel: document.getElementById('gasConfigPanel'),
    closeGasConfig: document.getElementById('closeGasConfig'),
    applyGasConfig: document.getElementById('applyGasConfig'),
    customGasPrice: document.getElementById('customGasPrice'),
    customGasLimit: document.getElementById('customGasLimit'),
    speedButtons: document.querySelectorAll('.speed-btn')
};

// ================ FUNCIONES PRINCIPALES ================
async function initApp() {
  try{  
    setupEventListeners();
    
    if (window.location.protocol === 'file:') {
        console.warn('Modo local detectado - Algunas funciones pueden estar limitadas');
    }
    
    if (window.ethereum?.selectedAddress) {
        await connectWallet();
    }
  } catch (error) {
        console.error("Error inicializando la app:", error);
  }    
}

async function connectWallet() {
    try {
        utils.showLoader("Conectando wallet...");
        
        const provider = detectProvider();
        if (!provider) {
            showMetaMaskModal();
            return false;
        }

        web3 = new Web3(provider);
        const accounts = await provider.request({ method: 'eth_requestAccounts' });
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
        utils.hideLoader();
    }
}

// ================ FUNCIONES DEL CONTRATO ================
async function loadInitialData() {
    try {
        utils.showLoader("Cargando datos...");
        
        const [balance, supply, paused, walletPaused, auxiliary] = await Promise.all([
            contract.methods.balanceOf(userAddress).call(),
            contract.methods.totalSupply().call(),
            contract.methods.paused().call(),
            contract.methods.isWalletPaused(userAddress).call(),
            contract.methods.auxiliaryOwner().call()
        ]);
        
        DOM.tokenBalance.textContent = `${fromWei(balance)} GO`;
        DOM.totalSupply.textContent = `${fromWei(supply)} GO`;
        DOM.contractStatus.textContent = paused ? '⛔ PAUSADO' : '✅ Activo';
        DOM.walletStatusIndicator.textContent = walletPaused ? '⛔ PAUSADA' : '✅ Activa';
        DOM.auxiliaryAddress.textContent = auxiliary === '0x0000000000000000000000000000000000000000' ? 'No asignado' : shortAddress(auxiliary);
        
        const owner = await contract.methods.owner().call();
        isOwner = userAddress.toLowerCase() === owner.toLowerCase();
        isAuxiliary = userAddress.toLowerCase() === auxiliary.toLowerCase();
        
        toggleRoleSections();
        
    } catch (error) {
        handleError(error, "Error cargando datos iniciales");
    } finally {
        utils.hideLoader();
    }
}

// ================ TRANSACCIONES ================
async function estimateTransactionGas(methodName, args = [], estimateElementId = null) {
    const gasOptions = getGasOptions();
    
    try {
        if (!userAddress) {
            showNotification("Conecta tu wallet primero", "error");
            return null;
        }

        showLoader("Estimando gas...");
        const gasEstimate = await contract.methods[methodName](...args)
            .estimateGas({ from: userAddress, ...gasOptions });
        
        if (estimateElementId && DOM[estimateElementId]) {
            DOM[estimateElementId].textContent = gasEstimate;
        }
        
        return gasEstimate;
    } catch (error) {
        handleError(error, "Error estimando gas");
        return null;
    } finally {
        utils.hideLoader();
    }
}

function getGasOptions() {
    const options = {};
    if (DOM.customGasPrice.value) {
        options.gasPrice = web3.utils.toWei(DOM.customGasPrice.value, 'gwei');
    }
    if (DOM.customGasLimit.value) {
        options.gas = DOM.customGasLimit.value;
    }
    return options;
}

async function mintTokens() {
    if (!isOwner) {
        showNotification("Solo el owner puede mintear tokens", "error");
        return;
    }
    
    try {
        if (!validateMintInputs()) return;
        
        const recipient = DOM.mintAddress.value;
        const amount = DOM.mintAmount.value;
        const gasOptions = getGasOptions();
        
        const gasEstimate = await estimateTransactionGas(
            'mint',
            [recipient, toWei(amount)],
            'mintGasEstimate'
        );
        
        if (!gasEstimate) return;

        utils.showLoader("Minteando tokens...");
        const tx = await contract.methods.mint(recipient, toWei(amount))
            .send({ 
                from: userAddress, 
                gas: Math.floor(gasEstimate * 1.2),
                ...gasOptions
            });
        
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
        utils.hideLoader();
    }
}

function validateMintInputs() {
    let isValid = true;
    
    if (!DOM.mintAddress.value || !web3.utils.isAddress(DOM.mintAddress.value)) {
        DOM.mintAddress.classList.add('input-error');
        isValid = false;
    } else {
        DOM.mintAddress.classList.remove('input-error');
    }
    
    if (!DOM.mintAmount.value || Number(DOM.mintAmount.value) <= 0) {
        DOM.mintAmount.classList.add('input-error');
        isValid = false;
    } else {
        DOM.mintAmount.classList.remove('input-error');
    }
    
    if (!isValid) {
        showNotification("Corrige los campos marcados", "error");
    }
    
    return isValid;
}

// ================ UTILIDADES ================
function toWei(amount) {
    return web3.utils.toWei(amount.toString(), 'ether');
}

function fromWei(amount) {
    return web3.utils.fromWei(amount.toString(), 'ether');
}

function shortAddress(address) {
    return address ? `${address.substring(0, 6)}...${address.substring(38)}` : "N/A";
}

function updateUI() {
    if (userAddress) {
        DOM.walletStatus.textContent = shortAddress(userAddress);
        DOM.networkStatus.className = 'connection-status-badge connected';
        DOM.walletInfo.style.display = 'flex';
        DOM.walletAddress.textContent = shortAddress(userAddress);
        DOM.connectBtn.style.display = 'none';
        DOM.disconnectBtn.style.display = 'block';
    } else {
        DOM.walletStatus.textContent = 'Desconectado';
        DOM.networkStatus.className = 'connection-status-badge disconnected';
        DOM.walletInfo.style.display = 'none';
        DOM.connectBtn.style.display = 'block';
        DOM.disconnectBtn.style.display = 'none';
    }
    toggleRoleSections();
}

function setupEventListeners() {
    // Verificar existencia de elementos antes de añadir listeners
    const elementsToCheck = [
        'connectWallet', 'disconnectWallet', 'copyWalletAddress', 
        'copyContractAddress', 'transferTokens', 'estimateTransferGas',
        'mintTokens', 'estimateMintGas'
    ];

    elementsToCheck.forEach(id => {
        if (!DOM[id]) {
            console.error(`Elemento no encontrado: ${id}`);
        }
    });
    
    // Conexión
    DOM.connectBtn?.addEventListener('click', connectWallet);
    DOM.disconnectBtn?.addEventListener('click', disconnectWallet);
    DOM.refreshBalance.addEventListener('click', loadInitialData);
    
    // Copiar direcciones
    DOM.copyWalletAddress?.addEventListener('click', () => {
        navigator.clipboard.writeText(userAddress)
            .then(() => showNotification("¡Dirección copiada!", "success"))
            .catch(err => console.error('Error al copiar:', err));
    });
    
    DOM.copyContractAddress.addEventListener('click', () => {
        const fullAddress = DOM.contractAddressShort.dataset.fullAddress;
        navigator.clipboard.writeText(fullAddress)
            .then(() => showNotification("¡Contrato copiado!", "success"))
            .catch(err => console.error('Error al copiar:', err));
    });
    
    // Transferencias
    DOM.transferBtn?.addEventListener('click', transferTokens);
    DOM.estimateTransferGas?.addEventListener('click', () => {
        estimateTransactionGas(
            'transfer',
            [DOM.recipientAddress.value, toWei(DOM.transferAmount.value)],
            'transferGasEstimate'
        );
    });
    
    // Mint
    DOM.mintBtn?.addEventListener('click', mintTokens);
    DOM.estimateMintGas?.addEventListener('click', () => {
        if (!validateMintInputs()) return;
        estimateTransactionGas(
            'mint',
            [DOM.mintAddress.value, toWei(DOM.mintAmount.value)],
            'mintGasEstimate'
        );
    });
    
     // Configuración de Gas (versión mejorada con validación)
    const gasConfigButtons = document.querySelectorAll('.gas-config-btn');
    if (gasConfigButtons.length > 0) {
        gasConfigButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                if (DOM.gasConfigPanel) {
                    DOM.gasConfigPanel.style.display = 'block';
                }
            });
        });
    }

    if (DOM.closeGasConfig && DOM.gasConfigPanel) {
        DOM.closeGasConfig.addEventListener('click', () => {
            DOM.gasConfigPanel.style.display = 'none';
        });
    }

    if (DOM.applyGasConfig) {
        DOM.applyGasConfig.addEventListener('click', applyGasConfig);
    }

    // Pestañas (versión segura)
    const tabButtons = document.querySelectorAll('.tab-btn');
    if (tabButtons.length > 0) {
        tabButtons.forEach(btn => {
            btn.addEventListener('click', switchTab);
        });
    }
}

function applyGasConfig() {
    const speed = document.querySelector('.speed-btn.active').dataset.speed;
    console.log('Configuración de gas aplicada:', { 
        gasPrice: DOM.customGasPrice.value,
        gasLimit: DOM.customGasLimit.value,
        speed 
    });
    DOM.gasConfigPanel.style.display = 'none';
}

function switchTab(e) {
    const tabId = e.currentTarget.getAttribute('data-tab');
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(tabId).classList.add('active');
    e.currentTarget.classList.add('active');
}

// Inicialización
if (document.readyState !== 'loading') {
    initApp();
} else {
    document.addEventListener('DOMContentLoaded', initApp);
}
