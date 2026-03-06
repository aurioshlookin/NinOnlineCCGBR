import { doc, updateDoc, onSnapshot, collection, getDocs } from "[https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js](https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js)";
import { db } from './firebase-config.js';

let currentPackCards = [];
let selectedCardsIndices = [];
let isOpeningPack = false;

onSnapshot(collection(db, "cards"), (snapshot) => {
    window.appState.cardDatabase = [];
    snapshot.forEach(doc => { window.appState.cardDatabase.push({ id: doc.id, ...doc.data() }); });
    
    document.getElementById('total-cards-count').innerText = window.appState.cardDatabase.length;
    document.getElementById('admin-card-count').innerText = window.appState.cardDatabase.length;
    
    const adminList = document.getElementById('admin-card-list');
    adminList.innerHTML = '';
    window.appState.cardDatabase.forEach(c => {
        adminList.innerHTML += `
            <tr>
                <td class="py-2">${c.name}</td>
                <td>${c.tier}</td>
                <td class="text-gray-500 text-xs">${c.img}</td>
                <td><button type="button" onclick="window.editCard('${c.id}')" class="text-green-400 hover:text-green-300 text-xs font-bold bg-gray-800 px-2 py-1 rounded border border-gray-600 transition">Editar</button></td>
            </tr>`;
    });

    if (window.appState.cardDatabase.length === 0) {
        document.getElementById('gacha-content').classList.add('hidden');
        document.getElementById('gacha-content').classList.remove('flex');
        if(window.appState.currentUser) document.getElementById('gacha-empty-db').classList.remove('hidden');
    } else if (window.appState.currentUser) {
        document.getElementById('gacha-content').classList.remove('hidden');
        document.getElementById('gacha-content').classList.add('flex');
        document.getElementById('gacha-empty-db').classList.add('hidden');
    }

    if (window.appState.currentUser) {
        window.renderAlbumHTML('album-grid', window.appState.userData.inventory);
        if(window.updateTradeOptions) window.updateTradeOptions();
    }
    if (window.appState.userData.role === 'admin' && window.loadGitHubImages) window.loadGitHubImages();
});

function getRandomCard() {
    if(window.appState.cardDatabase.length === 0) return null; 
    
    const roll = Math.floor(Math.random() * 10000) + 1;
    let targetTier = 'C';
    
    if (roll <= 5209) targetTier = 'C'; 
    else if (roll <= 9109) targetTier = 'B'; 
    else if (roll <= 9909) targetTier = 'A'; 
    else if (roll <= 9999) targetTier = 'S'; 
    else targetTier = 'SS'; 
    
    let possibleCards = window.appState.cardDatabase.filter(c => c.tier === targetTier);
    if(possibleCards.length === 0) possibleCards = window.appState.cardDatabase; 
    
    return possibleCards[Math.floor(Math.random() * possibleCards.length)];
}

window.openPack = async () => {
    let uData = window.appState.userData;
    if (!window.appState.currentUser || uData.pullsAvailable <= 0 || isOpeningPack || window.appState.cardDatabase.length === 0) return;
    isOpeningPack = true;
    
    const userRef = doc(db, "users", window.appState.currentUser.uid);
    let updateData = { pullsAvailable: uData.pullsAvailable - 1 };
    if (uData.pullsAvailable === 3) updateData.lastPullTimestamp = Date.now();
    await updateDoc(userRef, updateData);

    currentPackCards = [];
    let highestTierVal = 0;
    let highestTierStr = 'C';
    
    for(let i=0; i<8; i++) {
        const card = getRandomCard();
        currentPackCards.push(card);
        if (window.appState.TIER_VALUES[card.tier] > highestTierVal) {
            highestTierVal = window.appState.TIER_VALUES[card.tier];
            highestTierStr = card.tier;
        }
    }
    selectedCardsIndices = [];

    const pack = document.getElementById('booster-pack');
    
    if (pack) {
        if(highestTierVal >= 4) { 
            pack.classList.add(`glowing-${highestTierStr}`, 'shaking-violent');
        } else {
            pack.classList.add('shaking');
        }
        window.playGachaSound(highestTierStr);
    }

    const suspenseTime = highestTierVal >= 4 ? 1200 : 400;

    setTimeout(() => {
        if (pack) {
            pack.classList.remove('shaking', 'shaking-violent', 'glowing-SS', 'glowing-S', 'glowing-A');
            pack.classList.add('tearing');
            window.fireConfetti(highestTierStr);
        }

        setTimeout(() => {
            if (pack) {
                pack.classList.add('hidden'); pack.classList.remove('tearing');
            }
            const revealedContainer = document.getElementById('revealed-cards');
            if(revealedContainer) {
                revealedContainer.innerHTML = '';
                revealedContainer.classList.remove('hidden');

                for(let index=0; index<8; index++) {
                    revealedContainer.innerHTML += `
                        <div class="card-container w-24 h-36 sm:w-32 sm:h-48 md:w-40 md:h-60 cursor-pointer transform transition hover:scale-105" id="gacha-card-${index}" onclick="window.revealSingleCard(${index})">
                            <div class="card-inner shadow-2xl rounded-xl" id="gacha-card-inner-${index}">
                                <div class="card-back hover:shadow-green-500/50 transition duration-300 flex flex-col items-center justify-center">
                                    <img src="${window.appState.GITHUB_RAW_URL}icon.png" class="w-10 h-10 sm:w-16 sm:h-16 opacity-60 drop-shadow-[0_0_5px_rgba(34,197,94,0.4)]" alt="Card Logo">
                                </div>
                                <div class="card-front p-1 flex flex-col justify-between" id="gacha-card-front-${index}"></div>
                            </div>
                        </div>`;
                }
            }
        }, 400); 
    }, suspenseTime);
};

window.revealSingleCard = async (index) => {
    let uData = window.appState.userData;
    const innerContainer = document.getElementById(`gacha-card-inner-${index}`);
    if (!innerContainer || selectedCardsIndices.length >= 2 || innerContainer.classList.contains('flipped')) return;

    const cardData = currentPackCards[index];
    selectedCardsIndices.push(index);

    const newInventory = { ...uData.inventory };
    newInventory[cardData.id] = (newInventory[cardData.id] || 0) + 1;
    await updateDoc(doc(db, "users", window.appState.currentUser.uid), { inventory: newInventory });

    window.renderCardHTML(`gacha-card-front-${index}`, cardData, false, false, newInventory);
    innerContainer.classList.add('flipped');
    
    const cardContainer = document.getElementById(`gacha-card-${index}`);
    if (cardContainer) cardContainer.classList.remove('hover:scale-105');
    
    const ringColors = { 'C': 'ring-green-400', 'B': 'ring-blue-400', 'A': 'ring-purple-400', 'S': 'ring-yellow-400', 'SS': 'ring-red-500' };
    if (cardContainer) cardContainer.classList.add(`reveal-${cardData.tier}`, 'ring-4', ringColors[cardData.tier]);
    
    if (selectedCardsIndices.length === 2) {
        setTimeout(() => {
            for(let idx=0; idx<8; idx++) {
                if (!selectedCardsIndices.includes(idx)) {
                    const fakeCard = currentPackCards[idx];
                    const innerCard = document.getElementById(`gacha-card-inner-${idx}`);
                    window.renderCardHTML(`gacha-card-front-${idx}`, fakeCard, false, false, uData.inventory);
                    if (innerCard) innerCard.classList.add('flipped');
                    
                    const leftCardContainer = document.getElementById(`gacha-card-${idx}`);
                    if (leftCardContainer) {
                        leftCardContainer.classList.add('opacity-50', 'grayscale');
                        leftCardContainer.classList.remove('cursor-pointer', 'hover:scale-105', 'z-50', 'z-10');
                    }
                }
            }
            isOpeningPack = false;
            const btnNext = document.getElementById('btn-next');
            if (btnNext) {
                btnNext.classList.remove('hidden');
                if (uData.pullsAvailable <= 0) btnNext.innerText = "VER TEMPO DE RECARGA";
                else btnNext.innerText = "ABRIR PRÓXIMO PACOTE";
            }
        }, 1000); 
    }
};

window.resetPackArea = () => {
    const revealedCards = document.getElementById('revealed-cards');
    const btnNext = document.getElementById('btn-next');
    if (revealedCards) revealedCards.classList.add('hidden');
    if (btnNext) btnNext.classList.add('hidden');
    window.updateGachaUI(); 
};

window.updateGachaUI = () => {
    let uData = window.appState.userData;
    const pullsCountEl = document.getElementById('pulls-count');
    if (pullsCountEl) pullsCountEl.innerText = uData.pullsAvailable || 0;
    
    const containerVazio = document.getElementById('out-of-pulls-container');
    const boosterPack = document.getElementById('booster-pack');
    const msgCooldown = document.getElementById('cooldown-msg');

    if (uData.pullsAvailable <= 0 && !isOpeningPack) {
        if (boosterPack) boosterPack.classList.add('hidden');
        if (msgCooldown) msgCooldown.classList.add('hidden'); 
        if (containerVazio) {
            containerVazio.classList.remove('hidden');
            containerVazio.classList.add('flex');
        }
    } else if (!isOpeningPack && window.appState.cardDatabase.length > 0) {
        if (boosterPack) boosterPack.classList.remove('hidden');
        if (containerVazio) {
            containerVazio.classList.add('hidden');
            containerVazio.classList.remove('flex');
        }
        if (msgCooldown) msgCooldown.classList.add('hidden');
    }
};

window.renderCardHTML = (elementId, cardData, showQuantity = false, isAlbum = false, sourceInventory = {}) => {
    const container = document.getElementById(elementId);
    if(!container) return;
    const quantity = sourceInventory[cardData.id] || 0;
    
    const layout = cardData.layout || 'standard';
    const isFullArt = layout === 'full-art';
    
    const rankClasses = {
        'C': 'border-green-400 bg-gradient-to-br from-green-900 to-black',
        'B': 'border-blue-400 bg-gradient-to-br from-blue-900 to-black',
        'A': 'border-purple-400 bg-gradient-to-br from-purple-900 to-black',
        'S': 'border-yellow-400 bg-gradient-to-br from-yellow-900 to-black',
        'SS': 'border-red-500 bg-gradient-to-br from-red-900 to-black'
    };
    
    const tierColorText = {
        'C': 'text-green-400', 'B': 'text-blue-400', 'A': 'text-purple-400', 'S': 'text-yellow-400', 'SS': 'text-red-500'
    };

    if (isAlbum) container.className = `w-full h-full rounded-xl border-4 border-solid text-white relative overflow-hidden shadow-inner ${rankClasses[cardData.tier]}`;
    else container.className = `card-front flex flex-col justify-between rounded-xl border-4 border-solid relative overflow-hidden ${rankClasses[cardData.tier]}`;

    const fullImageUrl = cardData.img ? (window.appState.GITHUB_RAW_URL + cardData.img) : '';

    let foilEffect = '';
    if(cardData.tier === 'S') foilEffect = '<div class="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent mix-blend-overlay pointer-events-none z-20"></div>';
    if(cardData.tier === 'SS') foilEffect = '<div class="absolute inset-0 foil-anim mix-blend-color-dodge opacity-60 pointer-events-none z-20"></div>';

    let contentHTML = '';

    if(isFullArt) {
        contentHTML = `
            ${foilEffect}
            <div class="absolute inset-0 z-0">
                <img src="${fullImageUrl}" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='[https://via.placeholder.com/150/cbd5e0/4a5568?text=Sem+Imagem](https://via.placeholder.com/150/cbd5e0/4a5568?text=Sem+Imagem)';">
            </div>
            <div class="absolute top-1 left-1 right-1 z-10 flex justify-between">
                <span class="font-black text-[10px] sm:text-xs bg-black/80 px-1.5 py-0.5 rounded border border-gray-600 ${tierColorText[cardData.tier]} shadow-md">R.${cardData.tier}</span>
            </div>
            <div class="absolute bottom-0 left-0 right-0 p-2 sm:p-3 bg-gradient-to-t from-black via-black/80 to-transparent z-10">
                <h3 class="font-black text-white text-xs sm:text-sm drop-shadow-[0_2px_2px_rgba(0,0,0,1)]">${cardData.name}</h3>
                <p class="text-[9px] sm:text-[10px] text-gray-300 italic mt-0.5 leading-tight line-clamp-3">${cardData.desc}</p>
            </div>
            ${showQuantity && quantity > 1 ? `<div class="absolute top-1 right-1 bg-green-600 text-white text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-full shadow-lg border border-green-400 z-40">x${quantity}</div>` : ''}
        `;
    } else {
        contentHTML = `
            ${foilEffect}
            <div class="relative z-10 p-1 sm:p-2 h-full flex flex-col">
                <div class="flex justify-between items-center mb-1">
                    <h3 class="font-bold text-[10px] sm:text-xs text-white drop-shadow-md truncate max-w-[70%]">${cardData.name}</h3>
                    <span class="font-black text-[9px] sm:text-[10px] ${tierColorText[cardData.tier]} bg-black/60 px-1 rounded shadow-md">R.${cardData.tier}</span>
                </div>
                <div class="w-full aspect-[4/3] bg-black border-2 border-gray-500 overflow-hidden shadow-inner flex-shrink-0 rounded">
                    <img src="${fullImageUrl}" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='[https://via.placeholder.com/150/cbd5e0/4a5568?text=Sem+Imagem](https://via.placeholder.com/150/cbd5e0/4a5568?text=Sem+Imagem)';">
                </div>
                <div class="flex-grow mt-1 sm:mt-1.5 bg-black/40 p-1 sm:p-1.5 rounded border border-white/20 overflow-hidden text-center flex items-center justify-center">
                    <p class="text-[8px] sm:text-[9.px] text-gray-200 italic leading-tight line-clamp-4">${cardData.desc}</p>
                </div>
                ${showQuantity && quantity > 1 ? `<div class="absolute bottom-1 right-1 bg-green-600 text-white text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-full shadow-lg border border-green-400 z-40">x${quantity}</div>` : ''}
            </div>
        `;
    }
    container.innerHTML = contentHTML;
};

window.refreshAlbum = () => {
    window.renderAlbumHTML('album-grid', window.appState.userData.inventory);
};

window.renderAlbumHTML = (gridId, sourceInventory) => {
    const grid = document.getElementById(gridId);
    if(!grid) return;
    
    const isMyAlbum = gridId === 'album-grid';
    const mode = isMyAlbum ? window.currentAlbumView : 'grid';
    const sort = isMyAlbum ? window.currentAlbumSort : 'tier-desc';

    let uniqueCards = 0;
    let cardsArray = [...window.appState.cardDatabase];

    cardsArray.sort((a, b) => {
        const qtyA = sourceInventory[a.id] || 0;
        const qtyB = sourceInventory[b.id] || 0;
        if (sort === 'tier-desc') return window.appState.TIER_VALUES[b.tier] - window.appState.TIER_VALUES[a.tier];
        if (sort === 'tier-asc') return window.appState.TIER_VALUES[a.tier] - window.appState.TIER_VALUES[b.tier];
        if (sort === 'qty-desc') return qtyB - qtyA;
        if (sort === 'name-asc') return a.name.localeCompare(b.name);
        return 0;
    });

    cardsArray.forEach(card => { if((sourceInventory[card.id] || 0) > 0) uniqueCards++; });

    if (isMyAlbum) {
        const countEl = document.getElementById('collection-count');
        if (countEl) countEl.innerText = uniqueCards;
    }

    grid.innerHTML = '';
    
    if (mode === 'grid') {
        grid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4';
        cardsArray.forEach(card => {
            const quantity = sourceInventory[card.id] || 0;
            const wrapper = document.createElement('div');
            wrapper.className = "w-full aspect-[2/3] relative rounded-xl transition transform hover:scale-105 shadow-lg";
            
            if (quantity > 0) {
                const innerCard = document.createElement('div');
                innerCard.id = `card-${gridId}-${card.id}`;
                innerCard.className = "w-full h-full";
                wrapper.appendChild(innerCard);
                grid.appendChild(wrapper);
                window.renderCardHTML(innerCard.id, card, true, true, sourceInventory);
            } else {
                wrapper.className += " bg-gray-800 border-2 border-gray-700 flex items-center justify-center opacity-50";
                wrapper.innerHTML = `<span class="text-gray-500 font-bold text-xl">?</span>`;
                grid.appendChild(wrapper);
            }
        });
    } else if (mode === 'table') {
        grid.className = 'w-full overflow-x-auto bg-gray-800 rounded-xl border border-gray-700';
        let tableHTML = `<table class="w-full text-left text-sm whitespace-nowrap"><thead class="bg-gray-900 text-gray-400 border-b border-gray-700"><tr><th class="p-3">Imagem</th><th class="p-3">Carta</th><th class="p-3">Rank</th><th class="p-3">Descrição</th><th class="p-3 text-center">Quantidade</th></tr></thead><tbody class="divide-y divide-gray-700">`;
        
        cardsArray.forEach(card => {
            const quantity = sourceInventory[card.id] || 0;
            const hasCard = quantity > 0;
            const fullImageUrl = window.appState.GITHUB_RAW_URL + card.img;
            
            if (hasCard) {
                tableHTML += `<tr class="hover:bg-gray-700 text-white transition duration-150">
                    <td class="p-2"><img src="${fullImageUrl}" class="w-8 h-10 object-cover rounded border border-gray-500"></td>
                    <td class="p-3 font-bold">${card.name}</td>
                    <td class="p-3 font-bold text-yellow-400">${card.tier}</td>
                    <td class="p-3 truncate max-w-[200px]">${card.desc}</td>
                    <td class="p-3 text-center font-bold ${quantity > 1 ? 'text-green-400' : ''}">x${quantity}</td>
                </tr>`;
            } else {
                tableHTML += `<tr class="opacity-50 bg-gray-800 text-gray-500 transition duration-150">
                    <td class="p-2"><div class="w-8 h-10 bg-gray-700 rounded border border-gray-600 flex items-center justify-center font-bold">?</div></td>
                    <td class="p-3 font-bold">???</td>
                    <td class="p-3 font-bold">${card.tier}</td>
                    <td class="p-3">???</td>
                    <td class="p-3 text-center font-bold">-</td>
                </tr>`;
            }
        });
        tableHTML += `</tbody></table>`;
        grid.innerHTML = tableHTML;
    } else if (mode === 'ranked') {
        grid.className = 'flex flex-col gap-8 w-full';
        window.appState.TIER_ORDER.forEach(tier => {
            const cardsInTier = cardsArray.filter(c => c.tier === tier);
            if(cardsInTier.length === 0) return;
            
            let tierOwned = 0;
            cardsInTier.forEach(c => { if((sourceInventory[c.id] || 0) > 0) tierOwned++; });
            
            let sectionHTML = `<div>
                <h3 class="text-xl font-bold border-b border-gray-700 pb-2 mb-4 text-white flex justify-between">Rank ${tier} <span class="text-sm text-gray-400 font-normal">${tierOwned}/${cardsInTier.length}</span></h3>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4" id="tier-grid-${tier}"></div>
            </div>`;
            grid.insertAdjacentHTML('beforeend', sectionHTML);
            
            const tierGrid = document.getElementById(`tier-grid-${tier}`);
            cardsInTier.forEach(card => {
                const quantity = sourceInventory[card.id] || 0;
                const wrapper = document.createElement('div');
                wrapper.className = "w-full aspect-[2/3] relative rounded-xl transition transform hover:scale-105 shadow-lg";
                
                if (quantity > 0) {
                    const innerCard = document.createElement('div');
                    innerCard.id = `card-rank-${card.id}`;
                    innerCard.className = "w-full h-full";
                    wrapper.appendChild(innerCard);
                    tierGrid.appendChild(wrapper);
                    window.renderCardHTML(innerCard.id, card, true, true, sourceInventory);
                } else {
                    wrapper.className += " bg-gray-800 border-2 border-gray-700 flex items-center justify-center opacity-50";
                    wrapper.innerHTML = `<span class="text-gray-500 font-bold text-xl">?</span>`;
                    tierGrid.appendChild(wrapper);
                }
            });
        });
    }
};

window.loadAllPlayers = async (forceRefresh = false) => {
    let allPlayersCache = window.appState.allPlayersCache || [];
    if (allPlayersCache.length > 0 && !forceRefresh) return; 

    const errorEl = document.getElementById('explore-error');
    const loadingEl = document.getElementById('loading-players');
    const tbody = document.getElementById('players-table-body');
    
    errorEl.classList.add('hidden');
    tbody.innerHTML = '';
    loadingEl.classList.remove('hidden');

    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        allPlayersCache = [];
        querySnapshot.forEach(doc => allPlayersCache.push({ uid: doc.id, ...doc.data() }));
        
        allPlayersCache.sort((a, b) => {
            let stA = 0, stB = 0;
            window.appState.cardDatabase.forEach(c => { if(a.inventory && a.inventory[c.id]>0) stA++; if(b.inventory && b.inventory[c.id]>0) stB++; });
            return stB - stA;
        });
        window.appState.allPlayersCache = allPlayersCache;
        window.renderPlayersTable(allPlayersCache);
    } catch (err) {
        errorEl.innerText = "Erro ao carregar ranking.";
        errorEl.classList.remove('hidden');
    } finally {
        loadingEl.classList.add('hidden');
    }
};

window.renderPlayersTable = (players) => {
    const tbody = document.getElementById('players-table-body');
    tbody.innerHTML = '';
    if (players.length === 0) { tbody.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-gray-500">Nenhum ninja encontrado.</td></tr>`; return; }

    players.forEach(player => {
        let stats = { Total: 0, C: 0, B: 0, A: 0, S: 0, SS: 0 };
        window.appState.cardDatabase.forEach(c => { if(player.inventory && player.inventory[c.id]>0) { stats.Total++; stats[c.tier]++; } });
        
        tbody.innerHTML += `
            <tr class="hover:bg-gray-700 transition duration-150 ease-in-out">
                <td class="p-4 flex items-center gap-3 min-w-[150px]">
                    <img src="[https://api.dicebear.com/7.x/pixel-art/svg?seed=$](https://api.dicebear.com/7.x/pixel-art/svg?seed=$){player.displayName || player.uid}" class="w-8 h-8 rounded-full border border-gray-600 bg-gray-800">
                    <span class="font-bold text-white">${player.displayName || 'Ninja Oculto'}</span>
                </td>
                <td class="p-4 text-center font-bold text-lg">${stats.Total}</td>
                <td class="p-4 text-center text-green-400 font-semibold">${stats.C}</td>
                <td class="p-4 text-center text-blue-400 font-semibold">${stats.B}</td>
                <td class="p-4 text-center text-purple-400 font-semibold">${stats.A}</td>
                <td class="p-4 text-center text-yellow-400 font-semibold">${stats.S}</td>
                <td class="p-4 text-center text-red-400 font-bold">${stats.SS}</td>
                <td class="p-4 text-center">
                    <button onclick="window.viewPlayerAlbum('${player.uid}')" class="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded-lg text-xs font-bold transition shadow">Ver Álbum</button>
                </td>
            </tr>`;
    });
};

window.filterPlayers = () => {
    const searchVal = document.getElementById('search-input').value.trim().toLowerCase();
    if (!searchVal) return window.renderPlayersTable(window.appState.allPlayersCache);
    window.renderPlayersTable(window.appState.allPlayersCache.filter(p => p.displayNameLower && p.displayNameLower.includes(searchVal)));
};

window.viewPlayerAlbum = (uid) => {
    const player = window.appState.allPlayersCache.find(p => p.uid === uid);
    if (!player) return;
    document.getElementById('explore-table-container').classList.add('hidden');
    document.getElementById('explore-name').innerText = player.displayName;
    document.getElementById('explore-avatar').src = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${player.displayName || player.uid}`;
    window.renderAlbumHTML('explore-grid', player.inventory);
    document.getElementById('explore-results').classList.remove('hidden');
    document.getElementById('explore-results').classList.add('flex');
};

window.closePlayerAlbum = () => {
    document.getElementById('explore-results').classList.add('hidden');
    document.getElementById('explore-results').classList.remove('flex');
    document.getElementById('explore-table-container').classList.remove('hidden');
};
