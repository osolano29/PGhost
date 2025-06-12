// ================ CONFIGURACIÓN ================
import { CONTRACT_CONFIG, AMOY_CONFIG } from './ghost-token.js';

// Variables globales
let web3, contract, userAddress, isOwner = false, isAuxiliary = false;

// Elementos del DOM - Estructura mejorada
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
    estimateTransferGas: document.getElementById('estimateTransferGas'),
    recipientAddress: document.getElementById('recipientAddress'),
    transferAmount: document.getElementById('transferAmount'),
    transferGasEstimate: document.getElementById('transferGasEstimate'),
    transferGasUsed: document.getElementById('transferGasUsed'),
    
    // Quemado
    burnTokens: document.getElementById('burnTokens'),
    estimateBurnGas: document.getElementById('estimateBurnGas'),
    burnAmount: document.getElementById('burnAmount'),
    burnGasEstimate: document.getElementById('burnGasEstimate'),
    burnGasUsed: document.getElementById('burnGasUsed'),
    
    // Seguridad
    pauseWallet: document.getElementById('pauseWallet'),
    unpauseWallet: document.getElementById('unpauseWallet'),
    
    // Funciones de owner
    mintTokens: document.getElementById('mintTokens'),
    estimateMintGas: document.getElementById('estimateMintGas'),
    mintAddress: document.getElementById('mintAddress'),
    mintAmount: document.getElementById('mintAmount'),
    mintGasEstimate: document.getElementById('mintGasEstimate'),
    mintGasUsed: document.getElementById('mintGasUsed'),
    pauseContract: document.getElementById('pauseContract'),
    estimatePauseGas: document.getElementById('estimatePauseGas'),
    unpauseContract: document.getElementById('unpauseContract'),
    estimateUnpauseGas: document.getElementById('estimateUnpauseGas'),
    pauseGasEstimate: document.getElementById('pauseGasEstimate'),
    pauseGasUsed: document.getElementById('pauseGasUsed'),
    
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
    
    // Funciones de auxiliar
    setAuxiliaryBtn: document.getElementById('setAuxiliaryBtn'),
    estimateSetAuxiliaryGas: document.getElementById('estimateSetAuxiliaryGas'),
    claimOwnershipBtn: document.getElementById('claimOwnershipBtn'),
    estimateClaimOwnershipGas: document.getElementById('estimateClaimOwnershipGas'),
    newAuxiliary: document.getElementById('newAuxiliary'),
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
    
    // UI Elements
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
        
        // 1. Detección de MetaMask si esta instalada
        const provider = detectProvider();
        if (!provider) {
            showMetaMaskModal();
            return false;
        }
        // 2. Verificar conexión a la red correcta
        await verifyNetwork();
        // 2. Configurar Web3 y conectar
        web3 = new Web3(provider);
        const accounts = await provider.request({ method: 'eth_requestAccounts' });

        // Verificar si el usuario canceló la conexión
        if (!accounts || accounts.length === 0) {
            throw new Error("El usuario canceló la conexión");
        }
        userAddress = accounts[0];        
        // 4. Inicializar contrato
        initContract();
        
        // 3. Configurar red y contrato
        //await setupNetwork();
        
        //4. Inicializar contrato
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

async function verifyNetwork() {
    const expectedChainId = '0x13882'; // Polygon Amoy Testnet (80001 en decimal)
    
    try {
        const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
        
        if (currentChainId !== expectedChainId) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: expectedChainId }]
                });
            } catch (switchError) {
                // Si la red no está agregada, la añadimos
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
        throw new Error(`Error verificando la red: ${error.message}`);
    }
}

function disconnectWallet() {
    userAddress = null;
    isOwner = false;
    isAuxiliary = false;
    updateUI();
    showNotification("Wallet desconectada", "info");
}

// ================ FUNCIONES DE GAS ================

/**
 * Función genérica para estimar gas
 * @param {string} methodName - Nombre del método del contrato
 * @param {array} args - Argumentos para la función
 * @param {string} estimateElementId - ID del elemento para mostrar estimación
 * @returns {Promise<number>} - Estimación de gas
 */
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

/**
 * Muestra el gas usado en una transacción
 * @param {object} tx - Objeto de transacción
 * @param {string} usedElementId - ID del elemento para mostrar gas usado
 */
function showGasUsed(tx, usedElementId) {
    if (tx && tx.gasUsed && DOM[usedElementId]) {
        DOM[usedElementId].textContent = tx.gasUsed;
    }
}

// ================ FUNCIONES DEL CONTRATO ================

// ---- Funciones de Lectura ----
async function loadInitialData() {
    try {
        showLoader("Cargando datos...");
        const [balance, supply, paused, walletPaused, auxiliary, recoveryData] = await Promise.all([
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
        DOM.contractPausedStatus.textContent = paused ? '⛔ PAUSADO' : '✅ Activo';
        DOM.walletPausedStatus.textContent = walletPaused ? '⛔ PAUSADA' : '✅ Activa';
        
        // Verificar roles
        const owner = await contract.methods.owner().call();
        isOwner = userAddress.toLowerCase() === owner.toLowerCase();
        isAuxiliary = userAddress.toLowerCase() === auxiliary.toLowerCase();
        
        // Mostrar/ocultar funciones según roles
        toggleRoleSections();
        
        // Actualizar datos de recovery - ahora manejamos tanto objetos como arrays
        updateRecoveryUI(recoveryData);
        
    } catch (error) {
        handleError(error, "Error cargando datos iniciales");
    } finally {
        hideLoader();
    }
}

// ---- Funciones de Escritura ----
async function transferTokens() {
    try {
        const recipient = DOM.recipientAddress.value;
        const amount = DOM.transferAmount.value;
        
        validateAddress(recipient);
        validateAmount(amount);


        
        
        // Estimar gas
        const gasEstimate = await estimateTransactionGas(
            'transfer',
            [recipient, web3.utils.toWei(amount, 'ether')],
            'transferGasEstimate'
        );
        
        if (!gasEstimate) return;

        showLoader("Enviando transferencia...");
        const tx = await contract.methods.transfer(
            recipient, 
            web3.utils.toWei(amount, 'ether')
        ).send({ 
            from: userAddress,
            gas: Math.floor(gasEstimate * 1.2) // 20% más por seguridad
        });
        
        showGasUsed(tx, 'transferGasUsed');
        showNotification(`Transferencia exitosa! Gas usado: ${tx.gasUsed}`, "success");
        await loadInitialData();
        return tx;
        
    } catch (error) {
        if (error.receipt) {
            showGasUsed(error.receipt, 'transferGasUsed');
            handleError(error, `Error en transferencia (Gas usado: ${error.receipt.gasUsed})`);
        } else {
            handleError(error, "Error en transferencia");
        }
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
            [web3.utils.toWei(amount, 'ether')],
            'burnGasEstimate'
        );
        
        if (!gasEstimate) return;

        showLoader("Procesando quema...");
        const tx = await contract.methods.burn(
            web3.utils.toWei(amount, 'ether')
        ).send({ 
            from: userAddress,
            gas: Math.floor(gasEstimate * 1.2)
        });
        
        showGasUsed(tx, 'burnGasUsed');
        showNotification(`Tokens quemados exitosamente! Gas usado: ${tx.gasUsed}`, "success");
        await loadInitialData();
        return tx;
        
    } catch (error) {
        if (error.receipt) {
            showGasUsed(error.receipt, 'burnGasUsed');
            handleError(error, `Error quemando tokens (Gas usado: ${error.receipt.gasUsed})`);
        } else {
            handleError(error, "Error quemando tokens");
        }
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
            [recipient, web3.utils.toWei(amount, 'ether')],
            'mintGasEstimate'
        );
        
        if (!gasEstimate) return;

        showLoader("Minteando tokens...");
        const tx = await contract.methods.mint(
            recipient,
            web3.utils.toWei(amount, 'ether')
        ).send({ 
            from: userAddress,
            gas: Math.floor(gasEstimate * 1.2)
        });
        
        showGasUsed(tx, 'mintGasUsed');
        showNotification(`Tokens minteados exitosamente! Gas usado: ${tx.gasUsed}`, "success");
        await loadInitialData();
        return tx;
        
    } catch (error) {
        if (error.receipt) {
            showGasUsed(error.receipt, 'mintGasUsed');
            handleError(error, `Error minteando tokens (Gas usado: ${error.receipt.gasUsed})`);
        } else {
            handleError(error, "Error minteando tokens");
        }
        throw error;
    } finally {
        hideLoader();
    }
}

async function toggleWalletPause(pause) {
    try {
        const method = pause ? 'pauseMyWallet' : 'unpauseMyWallet';
        const estimateElementId = pause ? 'pauseWalletGasEstimate' : 'unpauseWalletGasEstimate';
        const usedElementId = pause ? 'pauseWalletGasUsed' : 'unpauseWalletGasUsed';
        
        // Estimar gas
        const gasEstimate = await estimateTransactionGas(method, [], estimateElementId);
        if (!gasEstimate) return;

        showLoader(pause ? "Pausando wallet..." : "Reanudando wallet...");
        const tx = await contract.methods[method]().send({ 
            from: userAddress,
            gas: Math.floor(gasEstimate * 1.2)
        });
        
        showGasUsed(tx, usedElementId);
        showNotification(
            `Wallet ${pause ? "pausada" : "reanudada"} correctamente! Gas usado: ${tx.gasUsed}`, 
            "success"
        );
        await loadInitialData();
        return tx;
        
    } catch (error) {
        if (error.receipt) {
            const usedElementId = pause ? 'pauseWalletGasUsed' : 'unpauseWalletGasUsed';
            showGasUsed(error.receipt, usedElementId);
            handleError(error, `Error ${pause ? "pausando" : "reanudando"} wallet (Gas usado: ${error.receipt.gasUsed})`);
        } else {
            handleError(error, pause ? "Error pausando wallet" : "Error reanudando wallet");
        }
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
        const estimateElementId = pause ? 'pauseGasEstimate' : 'unpauseGasEstimate';
        const usedElementId = pause ? 'pauseGasUsed' : 'unpauseGasUsed';
        
        // Estimar gas
        const gasEstimate = await estimateTransactionGas(method, [], estimateElementId);
        if (!gasEstimate) return;

        showLoader(pause ? "Pausando contrato..." : "Reanudando contrato...");
        const tx = await contract.methods[method]().send({ 
            from: userAddress,
            gas: Math.floor(gasEstimate * 1.2)
        });
        
        showGasUsed(tx, usedElementId);
        showNotification(
            `Contrato ${pause ? "pausado" : "reanudado"} correctamente! Gas usado: ${tx.gasUsed}`, 
            "success"
        );
        await loadInitialData();
        return tx;
        
    } catch (error) {
        if (error.receipt) {
            const usedElementId = pause ? 'pauseGasUsed' : 'unpauseGasUsed';
            showGasUsed(error.receipt, usedElementId);
            handleError(error, `Error ${pause ? "pausando" : "reanudando"} contrato (Gas usado: ${error.receipt.gasUsed})`);
        } else {
            handleError(error, pause ? "Error pausando contrato" : "Error reanudando contrato");
        }
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
            [newAuxiliary],
            'auxiliaryGasEstimate'
        );
        
        if (!gasEstimate) return;

        showLoader("Actualizando auxiliar...");
        const tx = await contract.methods.setAuxiliaryOwner(newAuxiliary)
            .send({ 
                from: userAddress,
                gas: Math.floor(gasEstimate * 1.2)
            });
        
        showGasUsed(tx, 'auxiliaryGasUsed');
        showNotification(`Auxiliar actualizado correctamente! Gas usado: ${tx.gasUsed}`, "success");
        await loadInitialData();
        return tx;
        
    } catch (error) {
        if (error.receipt) {
            showGasUsed(error.receipt, 'auxiliaryGasUsed');
            handleError(error, `Error asignando auxiliar (Gas usado: ${error.receipt.gasUsed})`);
        } else {
            handleError(error, "Error asignando auxiliar");
        }
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
            [],
            'auxiliaryGasEstimate'
        );
        
        if (!gasEstimate) return;

        showLoader("Iniciando proceso de recovery...");
        const tx = await contract.methods.claimOwnershipFromAuxiliary()
            .send({ 
                from: userAddress,
                gas: Math.floor(gasEstimate * 1.2)
            });
        
        showGasUsed(tx, 'auxiliaryGasUsed');
        showNotification(`Proceso de recovery iniciado! Gas usado: ${tx.gasUsed}`, "success");
        await loadInitialData();
        return tx;
        
    } catch (error) {
        if (error.receipt) {
            showGasUsed(error.receipt, 'auxiliaryGasUsed');
            handleError(error, `Error iniciando recovery (Gas usado: ${error.receipt.gasUsed})`);
        } else {
            handleError(error, "Error iniciando recovery");
        }
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
            [approve],
            'recoveryGasEstimate'
        );
        
        if (!gasEstimate) return;

        showLoader(approve ? "Aprobando recovery..." : "Rechazando recovery...");
        const tx = await contract.methods.approveRecovery(approve)
            .send({ 
                from: userAddress,
                gas: Math.floor(gasEstimate * 1.2)
            });
        
        showGasUsed(tx, 'recoveryGasUsed');
        showNotification(
            `Recovery ${approve ? "aprobado" : "rechazado"} correctamente! Gas usado: ${tx.gasUsed}`, 
            "success"
        );
        await loadInitialData();
        return tx;
        
    } catch (error) {
        if (error.receipt) {
            showGasUsed(error.receipt, 'recoveryGasUsed');
            handleError(error, `Error en aprobación de recovery (Gas usado: ${error.receipt.gasUsed})`);
        } else {
            handleError(error, "Error en aprobación de recovery");
        }
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
            [],
            'recoveryGasEstimate'
        );
        
        if (!gasEstimate) return;

        showLoader("Ejecutando recovery...");
        const tx = await contract.methods.executeRecovery()
            .send({ 
                from: userAddress,
                gas: Math.floor(gasEstimate * 1.2)
            });
        
        showGasUsed(tx, 'recoveryGasUsed');
        showNotification(`¡Ownership transferido exitosamente! Gas usado: ${tx.gasUsed}`, "success");
        await loadInitialData();
        return tx;
        
    } catch (error) {
        if (error.receipt) {
            showGasUsed(error.receipt, 'recoveryGasUsed');
            handleError(error, `Error ejecutando recovery (Gas usado: ${error.receipt.gasUsed})`);
        } else {
            handleError(error, "Error ejecutando recovery");
        }
        throw error;
    } finally {
        hideLoader();
    }
}

// ============ FUNCIONES DE APROBACIÓN ================

async function estimateApprovalGas() {
    try {
        const spender = DOM.spenderContract.value;
        const amount = DOM.approvalAmount.value;
        
        validateAddress(spender);
        validateAmount(amount);
        
        // Verificar si el contrato está autorizado
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
        
        // Verificar si el contrato está autorizado
        const isAllowed = await contract.methods.isContractAllowed(spender).call();
        if (!isAllowed) {
            throw new Error("El contrato no está en la lista de permitidos");
        }
        
        // Obtener estimación de gas
        const gasEstimate = await estimateApprovalGas();
        if (!gasEstimate) return;

        showLoader("Enviando aprobación...");
        const amountInWei = web3.utils.toWei(amount, 'ether');
        const tx = await contract.methods.approve(spender, amountInWei)
            .send({ 
                from: userAddress,
                gas: Math.floor(gasEstimate * 1.2)
            });
        
        showGasUsed(tx, 'approvalGasUsed');
        showNotification(`Aprobación exitosa! Gas usado: ${tx.gasUsed}`, "success");
        return tx;
        
    } catch (error) {
        if (error.receipt) {
            showGasUsed(error.receipt, 'approvalGasUsed');
            handleError(error, `Error en aprobación (Gas usado: ${error.receipt.gasUsed})`);
        } else {
            handleError(error, "Error en aprobación");
        }
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
        DOM.networkStatusText.textContent = "Polygon Amoy";
        DOM.networkStatus.className = "network-connected";
    } catch (error) {
        handleError(error, "Error configurando red");
        DOM.networkStatusText.textContent = "Red incorrecta";
        DOM.networkStatus.className = "network-error";
    }
}

function initContract() {
    contract = new web3.eth.Contract(
        CONTRACT_CONFIG.abi,
        CONTRACT_CONFIG.networks["80002"].address
    );
}

function toggleRoleSections() {
    DOM.ownerSection.style.display = isOwner ? 'block' : 'none';
    DOM.auxiliarySection.style.display = isAuxiliary ? 'block' : 'none';
}

function updateRecoveryUI(recoveryData) {
    try {
        // Manejar tanto objetos como arrays
        let nominee, deadline, approved;
        
        if (Array.isArray(recoveryData)) {
            // Si es un array (formato antiguo)
            [nominee, deadline, approved] = recoveryData;
        } else {
            // Si es un objeto (formato nuevo)
            nominee = recoveryData.nominee || recoveryData[0] || '0x0';
            deadline = recoveryData.deadline || recoveryData[1] || '0';
            approved = recoveryData.approved || recoveryData[2] || false;
        }

        DOM.recoveryNominee.textContent = nominee === '0x0' ? 'Ninguno' : shortAddress(nominee);
        DOM.recoveryDeadline.textContent = deadline === '0' ? 'N/A' : new Date(parseInt(deadline) * 1000).toLocaleString();
        DOM.recoveryApproved.textContent = approved ? '✅ Aprobado' : '❌ No aprobado';
        
        // Calcular tiempo restante si hay un deadline activo
        if (deadline !== '0') {
            const remaining = Math.max(0, parseInt(deadline) - Math.floor(Date.now() / 1000));
            const hours = Math.floor(remaining / 3600);
            const minutes = Math.floor((remaining % 3600) / 60);
            DOM.recoveryRemainingTime.textContent = `${hours}h ${minutes}m`;
        } else {
            DOM.recoveryRemainingTime.textContent = 'N/A';
        }
    } catch (error) {
        console.error("Error actualizando UI de recovery:", error);
        // Establecer valores por defecto si hay error
        DOM.recoveryNominee.textContent = 'Ninguno';
        DOM.recoveryDeadline.textContent = 'N/A';
        DOM.recoveryApproved.textContent = '❌ No aprobado';
        DOM.recoveryRemainingTime.textContent = 'N/A';
    }
}

function showMetaMaskModal() {
    if (DOM.metaMaskModal) {
        DOM.metaMaskModal.style.display = 'flex';
    }
}

// ================ UTILIDADES ================
function setupEventListeners() {
    // Conexión y operaciones básicas
    if (DOM.connectWallet) DOM.connectWallet.addEventListener('click', connectWallet);
    if (DOM.disconnectWallet) DOM.disconnectWallet.addEventListener('click', disconnectWallet);
    if (DOM.refreshBalance) DOM.refreshBalance.addEventListener('click', loadInitialData);
    
    // Transferencias
    if (DOM.transferTokens) DOM.transferTokens.addEventListener('click', transferTokens);
    if (DOM.estimateTransferGas) DOM.estimateTransferGas.addEventListener('click', () => 
        estimateTransactionGas(
            'transfer',
            [DOM.recipientAddress.value, web3.utils.toWei(DOM.transferAmount.value, 'ether')],
            'transferGasEstimate'
        )
    );
    
    // Quemado
    if (DOM.burnTokens) DOM.burnTokens.addEventListener('click', burnTokens);
    if (DOM.estimateBurnGas) DOM.estimateBurnGas.addEventListener('click', () => 
        estimateTransactionGas(
            'burn',
            [web3.utils.toWei(DOM.burnAmount.value, 'ether')],
            'burnGasEstimate'
        )
    );
    
    // Seguridad
    if (DOM.pauseWallet) DOM.pauseWallet.addEventListener('click', () => toggleWalletPause(true));
    if (DOM.unpauseWallet) DOM.unpauseWallet.addEventListener('click', () => toggleWalletPause(false));
    
    // Owner functions
    if (DOM.mintTokens) DOM.mintTokens.addEventListener('click', mintTokens);
    if (DOM.estimateMintGas) DOM.estimateMintGas.addEventListener('click', () => 
        estimateTransactionGas(
            'mint',
            [DOM.mintAddress.value, web3.utils.toWei(DOM.mintAmount.value, 'ether')],
            'mintGasEstimate'
        )
    );
    
    if (DOM.pauseContract) DOM.pauseContract.addEventListener('click', () => toggleContractPause(true));
    if (DOM.unpauseContract) DOM.unpauseContract.addEventListener('click', () => toggleContractPause(false));
    
    // Recovery
    if (DOM.approveRecoveryBtn) DOM.approveRecoveryBtn.addEventListener('click', () => approveRecovery(true));
    if (DOM.executeRecoveryBtn) DOM.executeRecoveryBtn.addEventListener('click', executeRecovery);
    
    // Auxiliar
    if (DOM.setAuxiliaryBtn) DOM.setAuxiliaryBtn.addEventListener('click', setAuxiliaryOwner);
    if (DOM.claimOwnershipBtn) DOM.claimOwnershipBtn.addEventListener('click', claimOwnership);
    
    // Aprobación
    if (DOM.estimateApprovalGas) DOM.estimateApprovalGas.addEventListener('click', estimateApprovalGas);
    if (DOM.approveTokens) DOM.approveTokens.addEventListener('click', approveTokens);
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

function showNotification(message, type = "success") {
    if (DOM.notification && DOM.notificationMessage) {
        DOM.notificationMessage.textContent = message;
        DOM.notification.className = `notification ${type}`;
        DOM.notification.style.display = 'block';
        
        setTimeout(() => {
            DOM.notification.style.display = 'none';
        }, 5000);
    }
}

function handleError(error, context = "") {
    console.error(context, error);
    
    let message = "Error desconocido";
    
    // Manejo específico de errores RPC
    if (error.code === 4001) {
        message = "Cancelado por el usuario";
    } else if (error.code === -32603) { // Internal JSON-RPC error
        if (error.data && error.data.message) {
            message = `Error interno: ${error.data.message}`;
        } else {
            message = "Error interno en la conexión con la blockchain";
        }
    } else if (error.message.includes("insufficient funds")) {
        message = "Fondos insuficientes para pagar el gas";
    } else if (error.message.includes("execution reverted")) {
        const revertMsg = error.message.match(/reason string: '(.+?)'/);
        message = revertMsg ? `Error en el contrato: ${revertMsg[1]}` : "Error en el contrato";
    } else if (error.message.includes("Network Error")) {
        message = "Problema de conexión con la red";
    } else {
        message = error.message || "Error desconocido";
    }
    
    showNotification(`${context}: ${message}`, "error");
    
    // Mostrar sugerencias específicas para ciertos errores
    if (message.includes("insufficient funds")) {
        showNotification("Por favor deposita MATIC en tu wallet para pagar las tarifas de gas", "info");
    } else if (message.includes("Network Error")) {
        showNotification("Verifica tu conexión a internet o intenta cambiar de red RPC", "info");
    }
}

function shortAddress(address) {
    return address ? `${address.substring(0, 6)}...${address.substring(38)}` : "N/A";
}

function showLoader(text = "") {
    if (DOM.loader) {
        DOM.loader.style.display = 'flex';
        if (DOM.loaderText && text) {
            DOM.loaderText.textContent = text;
        }
    }
}

function hideLoader() {
    if (DOM.loader) {
        DOM.loader.style.display = 'none';
    }
}

// En la función updateUI()
function updateUI() {
    if (userAddress) {
        // Actualizar dirección de wallet
        DOM.walletAddress.textContent = shortAddress(userAddress);
        
        // Configurar el evento de copiado para la wallet
        if (document.getElementById('copyWalletBtn')) {
            document.getElementById('copyWalletBtn').onclick = (e) => {
                e.preventDefault();
                copyToClipboard(userAddress, 'copyWalletFeedback');
            };
        }

        DOM.walletInfo.style.display = 'block';
        DOM.connectWallet.disabled = true;
        DOM.connectWallet.textContent = 'Conectado';
        DOM.disconnectWallet.style.display = 'block';
    } else {
        DOM.walletInfo.style.display = 'none';
        DOM.connectWallet.disabled = false;
        DOM.connectWallet.textContent = 'Conectar Wallet';
        DOM.disconnectWallet.style.display = 'none';
    }

    // Actualizar dirección del contrato
    if (contract && contract.options.address) {
        const contractAddress = contract.options.address;
        document.getElementById('contractAddressShort').textContent = shortAddress(contractAddress);
        
        // Configurar el evento de copiado para el contrato
        if (document.getElementById('copyContractBtn')) {
            document.getElementById('copyContractBtn').onclick = (e) => {
                e.preventDefault();
                copyToClipboard(contractAddress, 'copyContractFeedback');
            };
        }
    }
    
    toggleRoleSections();
}

// Añadir esta función si no existe
function copyToClipboard(text, feedbackId = null) {
    navigator.clipboard.writeText(text)
        .then(() => {
            if (feedbackId && document.getElementById(feedbackId)) {
                const feedback = document.getElementById(feedbackId);
                feedback.style.display = 'inline';
                setTimeout(() => {
                    feedback.style.display = 'none';
                }, 2000);
            } else {
                showNotification("¡Copiado al portapapeles!", "success");
            }
        })
        .catch(err => {
            console.error('Error al copiar: ', err);
            showNotification("Error al copiar al portapeles", "error");
        });
}

// Inicialización
if (document.readyState !== 'loading') {
    initApp();
} else {
    document.addEventListener('DOMContentLoaded', initApp);
}

// Manejo de cambios en la wallet
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
