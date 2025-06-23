// ================ CONFIGURACIÓN ================
import { CONTRACT_CONFIG, AMOY_CONFIG } from './ghost-token.js';

// Variables globales
let web3, contract, userAddress, isOwner = false, isAuxiliary = false;
let contractEventSubscriptions = [];

// ================ UTILIDADES ================
const utils = {
    showLoader(message = "") {
        if (DOM.loader) {
            DOM.loader.style.display = 'flex';
            if (message && DOM.loaderText) {
                DOM.loaderText.textContent = message;
            }
        }
    },
    hideLoader() {
        if (DOM.loader) {
            DOM.loader.style.display = 'none';
        }
    },
    compareAddresses(addr1, addr2) {
        return addr1 && addr2 && addr1.toLowerCase() === addr2.toLowerCase();
    }
};

function toWei(amount) {
    return web3.utils.toWei(amount.toString(), 'ether');
}

function fromWei(amount) {
    return parseFloat(web3.utils.fromWei(amount.toString(), 'ether'));
}

function shortAddress(address) {
    return address ? `${address.substring(0, 6)}...${address.substring(38)}` : "N/A";
}

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
    auxiliaryGasEstimate: document.getElementById('auxiliaryGasEstimate'),
    auxiliaryGasUsed: document.getElementById('auxiliaryGasUsed'),
    
    // Aprobación de gastos
    spenderContract: document.getElementById('spenderContract'),
    approvalAmount: document.getElementById('approvalAmount'),
    approvalGasEstimate: document.getElementById('approvalGasEstimate'),
    approvalGasUsed: document.getElementById('approvalGasUsed'),
    estimateApprovalGas: document.getElementById('estimateApprovalGas'),
    approveTokens: document.getElementById('approveTokens'),
    
    // UI
    loader: document.getElementById('loader'),
    loaderText: document.getElementById('loaderText'),
    notification: document.getElementById('notification'),
    notificationMessage: document.getElementById('notificationMessage'),
    ownerSection: document.getElementById('ownerSection'),
    auxiliarySection: document.getElementById('auxiliarySection'),
    metaMaskModal: document.getElementById('metaMaskModal'),

    // Sistema de recovery
    approveRecoveryBtn: document.getElementById('approveRecoveryBtn'),
    estimateApproveRecoveryGas: document.getElementById('estimateApproveRecoveryGas'),
    executeRecoveryBtn: document.getElementById('executeRecoveryBtn'),
    estimateExecuteRecoveryGas: document.getElementById('estimateExecuteRecoveryGas'),
    recoveryNominee: document.getElementById('recoveryNominee'),
    recoveryDeadline: document.getElementById('recoveryDeadline'),
    recoveryApproved: document.getElementById('recoveryApproved'),
    recoveryRemainingTime: document.getElementById('recoveryRemainingTime'),
    recoveryGasEstimate: document.getElementById('recoveryGasEstimate'),
    recoveryGasUsed: document.getElementById('recoveryGasUsed'),
    
    // Configuración de Gas
    gasConfigPanel: document.getElementById('gasConfigPanel'),
    closeGasConfig: document.getElementById('closeGasConfig'),
    applyGasConfig: document.getElementById('applyGasConfig'),
    customGasPrice: document.getElementById('customGasPrice'),
    customGasLimit: document.getElementById('customGasLimit'),
    pauseGasEstimate: document.getElementById('pauseGasEstimate'),
    pauseGasUsed: document.getElementById('pauseGasUsed'),
    speedButtons: document.querySelectorAll('.speed-btn')
};

// ================ FUNCIONES PRINCIPALES ================
const initApp = async () => {
    try {
        if (!isBrowserCompatible()) {
            showNotification("Tu navegador no es compatible con Web3. Por favor usa Chrome o Firefox con MetaMask.", "error");
            return;
        }
        
        setupEventListeners();
        
        if (window.ethereum?.selectedAddress) {
            await connectWallet();
        }
        
        setupWalletListeners();
    } catch (error) {
        handleCSPError(error);
    }
}

const detectProviderSafe = async () => {
    try {
        if (window.ethereum) {
            if (Array.isArray(window.ethereum.providers)) {
                const provider = window.ethereum.providers.find(p => p.isMetaMask) || window.ethereum;
                await provider.request({ method: 'eth_chainId' });
                return provider;
            }

            if (window.ethereum.isMetaMask) {
                await window.ethereum.request({ method: 'eth_chainId' });
            }

            return window.ethereum;
        }

        if (typeof window.web3 !== 'undefined' && window.web3.currentProvider?.isMetaMask) {
            return window.web3.currentProvider;
        }

        showMetaMaskModal();
        return null;
    } catch (error) {
        handleCSPError(error);
        return null;
    }
};

const isBrowserCompatible = () => {
    try {
        return (
            typeof Web3 === 'function' &&
            typeof window.ethereum === 'object' &&
            'request' in window.ethereum &&
            !navigator.userAgent.match(/PhantomJS/i)
        );
    } catch (e) {
        return false;
    }
};

const connectWallet = async () => {
    try {
        utils.showLoader("Conectando wallet...");
        
        const provider = await detectProviderSafe();
        if (!provider) return false;

        web3 = new Web3(provider);
        
        const accounts = await provider.request({ 
            method: 'eth_requestAccounts',
            params: [{ eth_chainId: AMOY_CONFIG.chainId }]
        }).catch(handleCSPError);
        
        if (!accounts || accounts.length === 0) {
            throw new Error("No se encontraron cuentas");
        }
        
        userAddress = accounts[0];
        await setupNetwork();
        await initContractSafe();
        await loadInitialData();
        updateUI();
        showNotification("¡Conectado correctamente!", "success");
        return true;
    } catch (error) {
        handleCSPError(error);
        return false;
    } finally {
        utils.hideLoader();
    }
}

async function disconnectWallet() {
    try {
        clearEventSubscriptions();
        userAddress = null;
        isOwner = false;
        isAuxiliary = false;
        updateUI();
        showNotification("Wallet desconectada", "info");
    } catch (error) {
        handleError(error, "Error al desconectar");
    }
}

function showMetaMaskModal() {
    if (DOM.metaMaskModal) {
        DOM.metaMaskModal.style.display = 'block';
        const closeBtn = DOM.metaMaskModal.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                DOM.metaMaskModal.style.display = 'none';
            });
        }
    }
}

async function setupNetwork() {
    try {
        const chainId = await web3.eth.getChainId();
        if (chainId.toString() !== AMOY_CONFIG.chainId) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: AMOY_CONFIG.chainId }],
                });
            } catch (switchError) {
                if (switchError.code === 4902) {
                    try {
                        await window.ethereum.request({
                            method: 'wallet_addEthereumChain',
                            params: [AMOY_CONFIG],
                        });
                    } catch (addError) {
                        throw new Error("No se pudo agregar la red Polygon Amoy");
                    }
                } else {
                    throw switchError;
                }
            }
        }
    } catch (error) {
        console.error("Error configurando la red:", error);
        throw error;
    }
}

const initContractSafe = async () => {
    try {
        if (!web3 || !web3.eth) {
            throw new Error("Web3 no está inicializado correctamente");
        }

        const config = CONTRACT_CONFIG;
        const networkId = "80002";
        
        if (!config.networks || !config.networks[networkId]) {
            throw new Error(`La red ${networkId} no está configurada en el contrato`);
        }

        contract = new web3.eth.Contract(
            config.abi,
            config.networks[networkId].address,
            {
                handleRevert: true,
                dataInputFill: 'allow',
                transactionPollingTimeout: 180000
            }
        );

        if (!contract || !contract.methods) {
            throw new Error("El contrato no se inicializó correctamente");
        }

        configureContractEventHandlers();

        if (DOM.contractAddressShort) {
            const fullAddress = config.networks[networkId].address;
            DOM.contractAddressShort.textContent = shortAddress(fullAddress);
            DOM.contractAddressShort.title = fullAddress;
            DOM.contractAddressShort.dataset.fullAddress = fullAddress;
        }

        console.log("✅ Contrato inicializado con éxito");
        return true;
    } catch (error) {
        handleCSPError(error);
        return false;
    }
};

function clearEventSubscriptions() {
    contractEventSubscriptions.forEach(sub => {
        try {
            sub.unsubscribe();
        } catch (e) {
            console.warn("Error al desuscribir evento:", e);
        }
    });
    contractEventSubscriptions = [];
}

function configureContractEventHandlers() {
    if (!contract || !contract.events) {
        console.warn("El contrato no está listo para suscribir eventos");
        return;
    }
    
    clearEventSubscriptions();

    const eventHandlers = {
        'Transfer': (event) => {
            console.log("Evento Transfer:", event);
            if (utils.compareAddresses(event.returnValues.from, userAddress) || 
                utils.compareAddresses(event.returnValues.to, userAddress)) {
                updateTokenBalance();
            }
        },
        'Approval': (event) => {
            console.log("Evento Approval:", event);
        }
    };

    Object.keys(eventHandlers).forEach(eventName => {
        try {
            const subscription = contract.events[eventName]({
                fromBlock: 'latest'
            })
            .on('data', eventHandlers[eventName])
            .on('error', err => {
                console.error(`Error en evento ${eventName}:`, err);
            });
            
            contractEventSubscriptions.push(subscription);
        } catch (error) {
            console.error(`Error suscribiendo al evento ${eventName}:`, error);
        }
    });
}

function setupWalletListeners() {
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', async (accounts) => {
            if (accounts.length === 0) {
                await disconnectWallet();
            } else {
                userAddress = accounts[0];
                await loadInitialData();
                updateUI();
                showNotification("Cuenta cambiada", "info");
            }
        });

        window.ethereum.on('chainChanged', async (chainId) => {
            if (chainId !== AMOY_CONFIG.chainId) {
                showNotification("Por favor cambia a Polygon Amoy", "warning");
            }
            await setupNetwork();
            await loadInitialData();
        });
    }
}

function showNotification(message, type = "info") {
    if (!DOM.notification || !DOM.notificationMessage) return;
    
    DOM.notificationMessage.textContent = message;
    DOM.notification.className = `notification ${type}`;
    DOM.notification.style.display = 'block';
    
    setTimeout(() => {
        DOM.notification.style.display = 'none';
    }, 5000);
}

function handleError(error, context = "") {
    console.error(context, error);
    let message = error.message || "Error desconocido";
    
    if (message.includes("User denied")) {
        message = "Transacción cancelada por el usuario";
    } else if (message.includes("insufficient funds")) {
        message = "Fondos insuficientes para la transacción";
    } else if (message.includes("Content Security Policy")) {
        message = "Error de seguridad del navegador. Actualiza o usa otro navegador.";
    }
    
    showNotification(`${context}: ${message}`, "error");
}

const handleCSPError = (error) => {
    console.error("Error de seguridad:", error);
    
    if (/Content Security Policy|eval|Function/i.test(error.message)) {
        showNotification(`Error de seguridad: Por favor actualiza tu navegador o desactiva extensiones que puedan interferir`, "error");
    } else {
        handleError(error, "Error en la aplicación");
    }
};

function updateRecoveryUI(recoveryData) {
    if (!recoveryData || typeof recoveryData !== 'object') return;
    
    const nominee = recoveryData.nominee || recoveryData[0];
    const deadline = recoveryData.deadline || recoveryData[1];
    const approved = recoveryData.approved || recoveryData[2];
    const remainingTime = recoveryData.remainingTime || recoveryData[3];
    
    if (DOM.recoveryNominee) {
        DOM.recoveryNominee.textContent = nominee === '0x0' ? 'Ninguno' : shortAddress(nominee);
    }
    if (DOM.recoveryDeadline) {
        DOM.recoveryDeadline.textContent = deadline === '0' ? 'N/A' : new Date(deadline * 1000).toLocaleString();
    }
    if (DOM.recoveryApproved) {
        DOM.recoveryApproved.textContent = approved ? '✅ Aprobado' : '❌ No aprobado';
    }
    if (DOM.recoveryRemainingTime) {
        DOM.recoveryRemainingTime.textContent = remainingTime === '0' ? 'N/A' : `${remainingTime} segundos`;
    }
}

async function loadInitialData() {
    try {
        utils.showLoader("Cargando datos...");
        
        if (!contract || !contract.methods || !userAddress) {
            return;
        }

        const results = await Promise.all([
            contract.methods.balanceOf(userAddress).call(),
            contract.methods.totalSupply().call(),
            contract.methods.paused().call(),
            contract.methods.isWalletPaused(userAddress).call(),
            contract.methods.auxiliaryOwner().call(),
            contract.methods.recoveryStatus().call()
        ]);

        const [balance, supply, paused, walletPaused, auxiliary, recovery] = results;

        DOM.tokenBalance.textContent = `${fromWei(balance)} GO`;
        DOM.totalSupply.textContent = `${fromWei(supply)} GO`;
        DOM.contractStatus.textContent = paused ? '⛔ PAUSADO' : '✅ Activo';
        DOM.walletStatusIndicator.textContent = walletPaused ? '⛔ PAUSADA' : '✅ Activa';
        DOM.auxiliaryAddress.textContent = auxiliary === '0x0000000000000000000000000000000000000000' ? 
            'No asignado' : shortAddress(auxiliary);

        const owner = await contract.methods.owner().call();
        isOwner = utils.compareAddresses(userAddress, owner);
        isAuxiliary = utils.compareAddresses(userAddress, auxiliary);
        
        toggleRoleSections();
        updateRecoveryUI(recovery);
    } catch (error) {
        handleError(error, "Error cargando datos iniciales");
    } finally {
        utils.hideLoader();
    }
}

async function updateTokenBalance() {
    try {
        if (!contract || !userAddress) return;
        
        const balance = await contract.methods.balanceOf(userAddress).call();
        DOM.tokenBalance.textContent = `${fromWei(balance)} GO`;
    } catch (error) {
        console.error("Error actualizando balance:", error);
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

        utils.showLoader("Estimando gas...");
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
    if (DOM.customGasPrice?.value) {
        options.gasPrice = web3.utils.toWei(DOM.customGasPrice.value, 'gwei');
    }
    if (DOM.customGasLimit?.value) {
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
        const amountInWei = toWei(amount);
        
        const gasEstimate = await estimateTransactionGas(
            'mint',
            [recipient, amountInWei],
            'mintGasEstimate'
        );
        
        if (!gasEstimate) return;

        utils.showLoader("Minteando tokens...");
        const tx = await contract.methods.mint(recipient, amountInWei)
            .send({ 
                from: userAddress,
                gas: Math.floor(gasEstimate * 1.2)
            });
        
        showNotification(`Tokens minteados exitosamente! Gas usado: ${tx.gasUsed}`, "success");
        await loadInitialData();
    } catch (error) {
        handleError(error, "Error minteando tokens");
    } finally {
        utils.hideLoader();
    }
}

async function transferTokens() {
    try {
        if (!validateTransferInputs()) return;
        
        const recipient = DOM.recipientAddress.value;
        const amount = DOM.transferAmount.value;
        const gasOptions = getGasOptions();
        
        const gasEstimate = await estimateTransactionGas(
            'transfer',
            [recipient, toWei(amount)],
            'transferGasEstimate'
        );
        
        if (!gasEstimate) return;

        utils.showLoader("Enviando transferencia...");
        const tx = await contract.methods.transfer(recipient, toWei(amount))
            .send({ 
                from: userAddress, 
                gas: Math.floor(gasEstimate * 1.2),
                ...gasOptions
            });
        
        showNotification(`Transferencia exitosa! Gas usado: ${tx.gasUsed}`, "success");
        await loadInitialData();
    } catch (error) {
        handleError(error, "Error en transferencia");
    } finally {
        utils.hideLoader();
    }
}

async function burnTokens() {
    try {
        const amount = DOM.burnAmount.value;
        validateAmount(amount);
        
        const gasEstimate = await estimateTransactionGas(
            'burn',
            [web3.utils.toWei(amount, 'ether')],
            'burnGasEstimate'
        );
        
        if (!gasEstimate) return;

        utils.showLoader("Procesando quema...");
        const tx = await contract.methods.burn(
            web3.utils.toWei(amount, 'ether')
        ).send({ 
            from: userAddress,
            gas: Math.floor(gasEstimate * 1.2)
        });
        
        showNotification(`Tokens quemados exitosamente! Gas usado: ${tx.gasUsed}`, "success");
        await loadInitialData();
    } catch (error) {
        handleError(error, "Error quemando tokens");
    } finally {
        utils.hideLoader();
    }
}

async function toggleWalletPause(pause) {
    try {
        const method = pause ? 'pauseMyWallet' : 'unpauseMyWallet';
        const estimateElementId = pause ? 'pauseWalletGasEstimate' : 'unpauseWalletGasEstimate';
        const usedElementId = pause ? 'pauseWalletGasUsed' : 'unpauseWalletGasUsed';
        
        const gasEstimate = await estimateTransactionGas(method, [], estimateElementId);
        if (!gasEstimate) return;

        utils.showLoader(pause ? "Pausando wallet..." : "Reanudando wallet...");
        const tx = await contract.methods[method]().send({ 
            from: userAddress,
            gas: Math.floor(gasEstimate * 1.2)
        });
        
        showNotification(
            `Wallet ${pause ? "pausada" : "reanudada"} correctamente! Gas usado: ${tx.gasUsed}`, 
            "success"
        );
        await loadInitialData();
    } catch (error) {
        handleError(error, pause ? "Error pausando wallet" : "Error reanudando wallet");
    } finally {
        utils.hideLoader();
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

        utils.showLoader(pause ? "Pausando contrato..." : "Reanudando contrato...");
        const tx = await contract.methods[method]().send({ 
            from: userAddress,
            gas: Math.floor(gasEstimate * 1.2)
        });
        
        showNotification(
            `Contrato ${pause ? "pausado" : "reanudado"} correctamente! Gas usado: ${tx.gasUsed}`, 
            "success"
        );
        await loadInitialData();
    } catch (error) {
        handleError(error, pause ? "Error pausando contrato" : "Error reanudando contrato");
    } finally {
        utils.hideLoader();
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

        utils.showLoader("Actualizando auxiliar...");
        const tx = await contract.methods.setAuxiliaryOwner(newAuxiliary)
            .send({ 
                from: userAddress,
                gas: Math.floor(gasEstimate * 1.2)
            });
        
        showNotification(`Auxiliar actualizado correctamente! Gas usado: ${tx.gasUsed}`, "success");
        await loadInitialData();
    } catch (error) {
        handleError(error, "Error asignando auxiliar");
    } finally {
        utils.hideLoader();
    }
}

async function approveRecovery(approve) {
    if (!isOwner) {
        showNotification("Solo el owner puede aprobar recovery", "error");
        return;
    }
    
    try {
        const gasEstimate = await estimateTransactionGas(
            'approveRecovery',
            [approve],
            'recoveryGasEstimate'
        );
        
        if (!gasEstimate) return;

        utils.showLoader(approve ? "Aprobando recovery..." : "Rechazando recovery...");
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
    } catch (error) {
        handleError(error, "Error en aprobación de recovery");
    } finally {
        utils.hideLoader();
    }
}

async function executeRecovery() {
    try {
        const gasEstimate = await estimateTransactionGas(
            'executeRecovery',
            [],
            'recoveryGasEstimate'
        );
        
        if (!gasEstimate) return;

        utils.showLoader("Ejecutando recovery...");
        const tx = await contract.methods.executeRecovery()
            .send({ 
                from: userAddress,
                gas: Math.floor(gasEstimate * 1.2)
            });
        
        showNotification(`¡Ownership transferido exitosamente! Gas usado: ${tx.gasUsed}`, "success");
        await loadInitialData();
    } catch (error) {
        handleError(error, "Error ejecutando recovery");
    } finally {
        utils.hideLoader();
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

        utils.showLoader("Iniciando proceso de recovery...");
        const tx = await contract.methods.claimOwnershipFromAuxiliary()
            .send({ 
                from: userAddress,
                gas: Math.floor(gasEstimate * 1.2)
            });
        
        showNotification(`Proceso de recovery iniciado! Gas usado: ${tx.gasUsed}`, "success");
        await loadInitialData();
    } catch (error) {
        handleError(error, "Error iniciando recovery");
    } finally {
        utils.hideLoader();
    }
}

async function estimateApprovalGas() {
    try {
        const spender = DOM.spenderContract.value;
        const amount = DOM.approvalAmount.value;
        
        validateAddress(spender);
        validateAmount(amount);
        
        const isAllowed = await contract.methods.isContractAllowed(spender).call();
        if (!isAllowed) {
            throw new Error("El contrato no está en la lista de permitidos");
        }
        
        const amountInWei = web3.utils.toWei(amount, 'ether');
        const gasEstimate = await estimateTransactionGas(
            'approve',
            [spender, amountInWei],
            'approvalGasEstimate'
        );
        
        if (gasEstimate) {
            showNotification(`Gas estimado: ${gasEstimate}`, "info");
        }
        
        return gasEstimate;
    } catch (error) {
        handleError(error, "Error estimando gas");
        throw error;
    }
}

async function approveTokens() {
    try {
        const spender = DOM.spenderContract.value;
        const amount = DOM.approvalAmount.value;
        
        validateAddress(spender);
        validateAmount(amount);
        
        const isAllowed = await contract.methods.isContractAllowed(spender).call();
        if (!isAllowed) {
            throw new Error("El contrato no está en la lista de permitidos");
        }
        
        const gasEstimate = await estimateApprovalGas();
        if (!gasEstimate) return;

        utils.showLoader("Enviando aprobación...");
        const amountInWei = web3.utils.toWei(amount, 'ether');
        const tx = await contract.methods.approve(spender, amountInWei)
            .send({ 
                from: userAddress,
                gas: Math.floor(gasEstimate * 1.2)
            });
        
        showNotification(`Aprobación exitosa! Gas usado: ${tx.gasUsed}`, "success");
    } catch (error) {
        handleError(error, "Error en aprobación");
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

function validateTransferInputs() {
    let isValid = true;
    
    if (!DOM.recipientAddress.value || !web3.utils.isAddress(DOM.recipientAddress.value)) {
        DOM.recipientAddress.classList.add('input-error');
        isValid = false;
    } else {
        DOM.recipientAddress.classList.remove('input-error');
    }
    
    if (!DOM.transferAmount.value || Number(DOM.transferAmount.value) <= 0) {
        DOM.transferAmount.classList.add('input-error');
        isValid = false;
    } else {
        DOM.transferAmount.classList.remove('input-error');
    }
    
    if (!isValid) {
        showNotification("Corrige los campos marcados", "error");
    }
    
    return isValid;
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

function toggleRoleSections() {
    if (isOwner) {
        DOM.ownerSection.style.display = 'block';
    } else {
        DOM.ownerSection.style.display = 'none';
    }
    
    if (isAuxiliary) {
        DOM.auxiliarySection.style.display = 'block';
    } else {
        DOM.auxiliarySection.style.display = 'none';
    }
}

function setupEventListeners() {
    // Conexión
    if (DOM.connectBtn) {
        DOM.connectBtn.addEventListener('click', connectWallet);
    }
    
    // Desconexión
    if (DOM.disconnectBtn) {
        DOM.disconnectBtn.addEventListener('click', disconnectWallet);
    }
    
    // Actualizar balance
    if (DOM.refreshBalance) {
        DOM.refreshBalance.addEventListener('click', loadInitialData);
    }
    
    // Copiar direcciones
    if (DOM.copyWalletAddress) {
        DOM.copyWalletAddress.addEventListener('click', () => {
            navigator.clipboard.writeText(userAddress)
                .then(() => showNotification("¡Dirección copiada!", "success"))
                .catch(err => console.error('Error al copiar:', err));
        });
    }
    
    if (DOM.copyContractAddress) {
        DOM.copyContractAddress.addEventListener('click', () => {
            const fullAddress = DOM.contractAddressShort.dataset.fullAddress;
            navigator.clipboard.writeText(fullAddress)
                .then(() => showNotification("¡Contrato copiado!", "success"))
                .catch(err => console.error('Error al copiar:', err));
        });
    }
    
    // Transferencias
    if (DOM.transferBtn) {
        DOM.transferBtn.addEventListener('click', transferTokens);
    }
    
    if (DOM.estimateTransferGas) {
        DOM.estimateTransferGas.addEventListener('click', () => {
            estimateTransactionGas(
                'transfer',
                [DOM.recipientAddress.value, toWei(DOM.transferAmount.value)],
                'transferGasEstimate'
            );
        });
    }
    
    // Mint
    if (DOM.mintBtn) {
        DOM.mintBtn.addEventListener('click', mintTokens);
    }
    
    if (DOM.estimateMintGas) {
        DOM.estimateMintGas.addEventListener('click', () => {
            if (!validateMintInputs()) return;
            estimateTransactionGas(
                'mint',
                [DOM.mintAddress.value, toWei(DOM.mintAmount.value)],
                'mintGasEstimate'
            );
        });
    }
    
    // Funciones de auxiliar
    if (DOM.setAuxiliaryBtn) {
        DOM.setAuxiliaryBtn.addEventListener('click', setAuxiliaryOwner);
    }
    
    if (DOM.claimOwnershipBtn) {
        DOM.claimOwnershipBtn.addEventListener('click', claimOwnership);
    }
    
    // Recovery
    if (DOM.approveRecoveryBtn) {
        DOM.approveRecoveryBtn.addEventListener('click', () => approveRecovery(true));
    }
    
    if (DOM.executeRecoveryBtn) {
        DOM.executeRecoveryBtn.addEventListener('click', executeRecovery);
    }
    
    // Pausas
    if (DOM.pauseWalletBtn) {
        DOM.pauseWalletBtn.addEventListener('click', () => toggleWalletPause(true));
    }
    
    if (DOM.unpauseWalletBtn) {
        DOM.unpauseWalletBtn.addEventListener('click', () => toggleWalletPause(false));
    }
    
    if (DOM.pauseContractBtn) {
        DOM.pauseContractBtn.addEventListener('click', () => toggleContractPause(true));
    }
    
    if (DOM.unpauseContractBtn) {
        DOM.unpauseContractBtn.addEventListener('click', () => toggleContractPause(false));
    }
    
    // Quemar tokens
    if (DOM.burnBtn)
        DOM.burnBtn.addEventListener('click', burnTokens);
    }
    
    // Aprobación de gastos
    if (DOM.estimateApprovalGas) {
        DOM.estimateApprovalGas.addEventListener('click', estimateApprovalGas);
    }
    
    if (DOM.approveTokens) {
        DOM.approveTokens.addEventListener('click', approveTokens);
    }
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    initApp().catch(handleCSPError);
});
