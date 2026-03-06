import { doc, updateDoc, addDoc, collection, serverTimestamp } from "[https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js](https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js)";
import { db } from './firebase-config.js';

let isFetchingImages = false; 
let selectedAdminImage = ""; 
let editingCardId = null;
        
window.loadGitHubImages = async () => {
    if(isFetchingImages) return; 
    isFetchingImages = true;

    const loading = document.getElementById('github-images-loading');
    const grid = document.getElementById('github-images-grid');
    const emptyMsg = document.getElementById('github-images-empty');

    loading.classList.remove('hidden');
    emptyMsg.classList.add('hidden');
    selectedAdminImage = "";

    try {
        const response = await fetch('[https://api.github.com/repos/aurioshlookin/NinCardMemeCollectionBR/contents/assets/cards](https://api.github.com/repos/aurioshlookin/NinCardMemeCollectionBR/contents/assets/cards)');
        if (!response.ok) throw new Error("Erro da API");
        const files = await response.json();

        const usedImages = window.appState.cardDatabase.filter(c => c.id !== editingCardId).map(c => c.img);
        const availableImages = files.filter(f =>
            f.type === 'file' &&
            f.name.match(/\.(png|jpg|jpeg|gif)$/i) &&
            !usedImages.includes(f.name)
        );

        grid.innerHTML = ''; 
        loading.classList.add('hidden');

        if (availableImages.length === 0) {
            emptyMsg.classList.remove('hidden');
            return;
        }

        availableImages.forEach(file => {
            const imgDiv = document.createElement('div');
            imgDiv.className = "cursor-pointer rounded border-2 border-transparent hover:border-green-400 transition overflow-hidden h-24 bg-gray-800 relative group";
            imgDiv.onclick = () => window.selectAdminImage(file.name, imgDiv);
            
            if (selectedAdminImage === file.name) {
                imgDiv.classList.remove('border-transparent');
                imgDiv.classList.add('border-green-500', 'ring-2', 'ring-green-400');
            }

            imgDiv.innerHTML = `
                <img src="${file.download_url}" class="w-full h-full object-cover group-hover:scale-110 transition duration-300">
                <div class="absolute bottom-0 left-0 right-0 bg-black/80 text-[10px] text-center truncate px-1 py-0.5 text-white font-semibold">${file.name}</div>
            `;
            grid.appendChild(imgDiv);
        });

    } catch (err) {
        loading.innerText = "Erro ao carregar imagens. Pasta assets/cards existe?";
        loading.classList.replace('text-green-400', 'text-red-400');
    } finally {
        isFetchingImages = false; 
    }
};

window.selectAdminImage = (fileName, element) => {
    selectedAdminImage = fileName;
    const grid = document.getElementById('github-images-grid');
    Array.from(grid.children).forEach(child => {
        child.classList.remove('border-green-500', 'ring-2', 'ring-green-400', 'border-transparent');
        child.classList.add('border-transparent');
    });
    element.classList.remove('border-transparent');
    element.classList.add('border-green-500', 'ring-2', 'ring-green-400');
    window.updateAdminPreview(); 
};

window.updateAdminPreview = () => {
    const tempCard = {
        id: 'preview',
        name: document.getElementById('admin-name').value || 'Nome da Carta',
        tier: document.getElementById('admin-tier').value || 'C',
        layout: document.getElementById('admin-layout').value || 'standard',
        desc: document.getElementById('admin-desc').value || 'Descrição...',
        img: selectedAdminImage || ''
    };
    if(window.renderCardHTML) window.renderCardHTML('admin-preview-container', tempCard, false, true, {});
};

window.editCard = (id) => {
    const card = window.appState.cardDatabase.find(c => c.id === id);
    if (!card) return;
    editingCardId = id;
    document.getElementById('admin-name').value = card.name;
    document.getElementById('admin-tier').value = card.tier;
    document.getElementById('admin-layout').value = card.layout || 'standard';
    document.getElementById('admin-desc').value = card.desc;
    selectedAdminImage = card.img; 
    
    document.getElementById('admin-submit').innerText = "SALVAR ALTERAÇÕES";
    document.getElementById('admin-cancel-btn').classList.remove('hidden');
    window.updateAdminPreview();
    window.loadGitHubImages(); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.cancelEdit = () => {
    editingCardId = null;
    document.getElementById('admin-form').reset();
    selectedAdminImage = "";
    document.getElementById('admin-submit').innerText = "CRIAR CARTA E ADICIONAR AO JOGO";
    document.getElementById('admin-cancel-btn').classList.add('hidden');
    window.updateAdminPreview();
    window.loadGitHubImages();
};

document.getElementById('admin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('admin-submit');
    const msg = document.getElementById('admin-msg');
    
    if (!selectedAdminImage) {
        msg.innerText = "Erro: Selecione a imagem acima clicando nela!";
        msg.className = "text-center font-bold text-sm mt-2 text-red-400";
        msg.classList.remove('hidden');
        setTimeout(() => msg.classList.add('hidden'), 3000);
        return;
    }

    btn.disabled = true;
    btn.innerText = "Processando...";

    try {
        const cardData = {
            name: document.getElementById('admin-name').value,
            tier: document.getElementById('admin-tier').value,
            layout: document.getElementById('admin-layout').value,
            desc: document.getElementById('admin-desc').value,
            img: selectedAdminImage,
        };

        if (editingCardId) {
            await updateDoc(doc(db, "cards", editingCardId), cardData);
            msg.innerText = "Carta atualizada com sucesso!";
            editingCardId = null;
            document.getElementById('admin-submit').innerText = "CRIAR CARTA E ADICIONAR AO JOGO";
            document.getElementById('admin-cancel-btn').classList.add('hidden');
        } else {
            cardData.createdAt = serverTimestamp();
            await addDoc(collection(db, "cards"), cardData);
            msg.innerText = "Carta criada!";
        }
        
        msg.className = "text-center font-bold text-sm mt-2 text-green-400";
        msg.classList.remove('hidden');
        document.getElementById('admin-form').reset();
        selectedAdminImage = ""; 
        window.updateAdminPreview(); 
        window.loadGitHubImages(); 
    } catch (err) {
        msg.innerText = "Erro: " + err.message;
        msg.className = "text-center font-bold text-sm mt-2 text-red-400";
        msg.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        if(!editingCardId) btn.innerText = "CRIAR CARTA E ADICIONAR AO JOGO";
        setTimeout(() => msg.classList.add('hidden'), 5000);
    }
});
