/**
 * memo.js - Memo page logic
 * Chức năng ghi chú: tạo/sửa/xóa/lưu memo với IndexedDB
 */

const MemoPage = {
    currentMemoId: null,
    autoSaveTimeout: null,

    /**
     * Initialize memo page
     */
    async init() {
        await this.loadMemoList();
        this.setupAutoSave();
        this.setupSearch();
    },

    /**
     * Load and render memo list
     */
    async loadMemoList() {
        try {
            const memos = await MemoStorage.getAll();
            this.renderMemoList(memos);
        } catch (err) {
            console.warn('[Memo] Error loading memos:', err);
        }
    },

    /**
     * Render memo list
     */
    renderMemoList(memos) {
        const container = document.getElementById('memo-list');
        const countEl = document.getElementById('memo-count');
        if (!container) return;

        if (countEl) countEl.textContent = memos.length + ' ghi chú';

        if (memos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📝</div>
                    <h3>Chưa có ghi chú nào</h3>
                    <p>Nhấn "Tạo ghi chú mới" để bắt đầu</p>
                </div>
            `;
            return;
        }

        container.innerHTML = memos.map(memo => `
            <div class="memo-item ${memo.id === this.currentMemoId ? 'active' : ''}"
                 onclick="MemoPage.openMemo('${memo.id}')">
                <div class="memo-item-title">${escapeHtml(memo.title || 'Không có tiêu đề')}</div>
                <div class="memo-item-preview">${escapeHtml(memo.content || '').substring(0, 80)}</div>
                <div class="memo-item-meta">
                    <span class="memo-item-date">${formatDate(memo.updatedAt)}</span>
                    <button class="memo-item-delete" onclick="event.stopPropagation(); MemoPage.deleteMemo('${memo.id}')" title="Xóa">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    },

    /**
     * Create new memo
     */
    async createMemo() {
        const memo = {
            id: generateId(),
            title: '',
            content: '',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        try {
            await MemoStorage.save(memo);
            this.currentMemoId = memo.id;
            this.openEditor(memo);
            await this.loadMemoList();
            showToast('📝 Đã tạo ghi chú mới');
        } catch (err) {
            showToast('⚠️ Không thể tạo ghi chú');
        }
    },

    /**
     * Open memo in editor
     */
    async openMemo(id) {
        try {
            const memo = await MemoStorage.get(id);
            if (memo) {
                this.currentMemoId = id;
                this.openEditor(memo);
                await this.loadMemoList();
            }
        } catch (err) {
            showToast('⚠️ Không thể mở ghi chú');
        }
    },

    /**
     * Open editor with memo data
     */
    openEditor(memo) {
        const titleInput = document.getElementById('memo-title');
        const contentInput = document.getElementById('memo-content');
        const editor = document.getElementById('memo-editor');
        const saveStatus = document.getElementById('memo-save-status');

        if (titleInput) titleInput.value = memo.title || '';
        if (contentInput) contentInput.value = memo.content || '';
        if (editor) editor.style.display = 'block';
        if (saveStatus) saveStatus.textContent = '';

        // Focus on title if empty
        if (!memo.title && titleInput) titleInput.focus();
    },

    /**
     * Save current memo
     */
    async saveCurrent() {
        if (!this.currentMemoId) return;

        const title = document.getElementById('memo-title')?.value || '';
        const content = document.getElementById('memo-content')?.value || '';

        try {
            await MemoStorage.save({
                id: this.currentMemoId,
                title,
                content
            });

            const saveStatus = document.getElementById('memo-save-status');
            if (saveStatus) saveStatus.textContent = '✅ Đã lưu lúc ' + new Date().toLocaleTimeString('vi-VN');

            await this.loadMemoList();
        } catch (err) {
            const saveStatus = document.getElementById('memo-save-status');
            if (saveStatus) saveStatus.textContent = '⚠️ Lỗi khi lưu';
        }
    },

    /**
     * Delete memo with confirmation
     */
    async deleteMemo(id) {
        // Phase 3: Confirm before delete
        if (!confirm('Đảm bảo xóa ghi chú này? Thao tác không thể hoàn tác.')) return;
        
        try {
            await MemoStorage.delete(id);

            if (this.currentMemoId === id) {
                this.currentMemoId = null;
                const editor = document.getElementById('memo-editor');
                if (editor) editor.style.display = 'none';
            }

            await this.loadMemoList();
            showToast('🗑️ Đã xóa ghi chú');
        } catch (err) {
            showToast('⚠️ Không thể xóa ghi chú');
        }
    },

    /**
     * Setup auto-save on input + word count
     */
    setupAutoSave() {
        const titleInput = document.getElementById('memo-title');
        const contentInput = document.getElementById('memo-content');

        const autoSave = () => {
            if (this.autoSaveTimeout) clearTimeout(this.autoSaveTimeout);
            this.autoSaveTimeout = setTimeout(() => {
                this.saveCurrent();
            }, 1000);

            const saveStatus = document.getElementById('memo-save-status');
            if (saveStatus) saveStatus.textContent = '💾 Đang lưu...';
        };

        // Word count update
        const updateWordCount = () => {
            const content = contentInput?.value || '';
            const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
            const charCount = content.length;
            const wcEl = document.getElementById('memo-word-count');
            if (wcEl) wcEl.textContent = `${wordCount} từ · ${charCount} ký tự`;
        };

        if (titleInput) titleInput.addEventListener('input', autoSave);
        if (contentInput) {
            contentInput.addEventListener('input', () => {
                autoSave();
                updateWordCount();
            });
        }
    },

    /**
     * Setup memo search (Phase 3)
     */
    setupSearch() {
        const searchInput = document.getElementById('memo-search');
        if (!searchInput) return;

        searchInput.addEventListener('input', async () => {
            const query = searchInput.value.trim().toLowerCase();
            if (!query) {
                await this.loadMemoList();
                return;
            }
            
            try {
                const allMemos = await MemoStorage.getAll();
                const filtered = allMemos.filter(m => 
                    (m.title || '').toLowerCase().includes(query) ||
                    (m.content || '').toLowerCase().includes(query)
                );
                this.renderMemoList(filtered);
            } catch (err) {
                console.warn('[Memo] Search error:', err);
            }
        });
    }
};
