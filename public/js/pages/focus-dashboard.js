/**
 * focus-dashboard.js - Focus Session Dashboard (Task 23)
 * Biểu đồ lịch sử sessions + thống kê tập trung
 */

const FocusDashboard = {
    /**
     * Render focus dashboard with stats and chart
     */
    async render() {
        const container = document.getElementById('focus-dashboard-content');
        if (!container) return;

        try {
            const sessions = await SessionStorage.getAll();
            
            if (sessions.length === 0) {
                container.innerHTML = `
                    <div class="dashboard-empty">
                        <span style="font-size: 48px;">📊</span>
                        <h3>Chưa có dữ liệu</h3>
                        <p>Hoàn thành phiên học đầu tiên để xem thống kê!</p>
                    </div>
                `;
                return;
            }

            // Calculate stats
            const today = new Date();
            const todaySessions = sessions.filter(s => this._isSameDay(new Date(s.date), today));
            const weekSessions = sessions.filter(s => this._isThisWeek(new Date(s.date)));
            
            const totalMinutesToday = todaySessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60;
            const totalMinutesWeek = weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60;
            const avgFocus = sessions.reduce((sum, s) => sum + (s.focusPercent || 0), 0) / sessions.length;
            const totalDistractions = sessions.reduce((sum, s) => sum + (s.distractionCount || 0), 0);
            const avgTabLeave = sessions.reduce((sum, s) => sum + (s.tabLeaveCount || 0), 0) / sessions.length;

            // Streak calculation
            const streak = this._calculateStreak(sessions);

            container.innerHTML = `
                <div class="dashboard-stats">
                    <div class="stat-card">
                        <div class="stat-value">${Math.round(totalMinutesToday)}</div>
                        <div class="stat-label">Phút hôm nay</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${Math.round(totalMinutesWeek)}</div>
                        <div class="stat-label">Phút tuần này</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${Math.round(avgFocus)}%</div>
                        <div class="stat-label">Tập trung TB</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${streak}</div>
                        <div class="stat-label">🔥 Streak ngày</div>
                    </div>
                </div>

                <div class="dashboard-chart">
                    <h3>📈 Lịch sử 7 ngày gần nhất</h3>
                    <div class="chart-bars" id="chart-bars">
                        ${this._renderChart(sessions)}
                    </div>
                </div>

                <div class="dashboard-details">
                    <h3>📋 Phiên học gần đây</h3>
                    <div class="session-list">
                        ${sessions.slice(0, 5).map(s => `
                            <div class="session-item">
                                <div class="session-score ${this._getScoreClass(s.score)}">${s.score || '?'}</div>
                                <div class="session-info">
                                    <div class="session-duration">${Math.round((s.duration || 0) / 60)} phút</div>
                                    <div class="session-meta">${s.distractionCount || 0} xao nhãng · ${s.tabLeaveCount || 0} lần rời tab</div>
                                </div>
                                <div class="session-date">${this._formatDate(s.date)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } catch (err) {
            console.warn('[Dashboard] Error:', err);
            container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Không thể tải dữ liệu</p>';
        }
    },

    _renderChart(sessions) {
        const days = [];
        const today = new Date();
        
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const daySessions = sessions.filter(s => this._isSameDay(new Date(s.date), d));
            const totalMinutes = daySessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60;
            days.push({
                label: d.toLocaleDateString('vi-VN', { weekday: 'short' }),
                value: Math.round(totalMinutes),
                isToday: i === 0
            });
        }

        const maxVal = Math.max(...days.map(d => d.value), 1);

        return days.map(d => {
            const heightPercent = Math.max((d.value / maxVal) * 100, 4);
            return `
                <div class="chart-bar-col ${d.isToday ? 'today' : ''}">
                    <div class="chart-bar-value">${d.value}p</div>
                    <div class="chart-bar" style="height: ${heightPercent}%"></div>
                    <div class="chart-bar-label">${d.label}</div>
                </div>
            `;
        }).join('');
    },

    _isSameDay(d1, d2) {
        return d1.getFullYear() === d2.getFullYear() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getDate() === d2.getDate();
    },

    _isThisWeek(date) {
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        return date >= weekStart;
    },

    _calculateStreak(sessions) {
        if (sessions.length === 0) return 0;
        
        let streak = 0;
        const today = new Date();
        
        for (let i = 0; i < 365; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() - i);
            
            const hasSession = sessions.some(s => this._isSameDay(new Date(s.date), checkDate));
            if (hasSession) {
                streak++;
            } else if (i > 0) {
                break;
            }
        }
        
        return streak;
    },

    _getScoreClass(score) {
        if (score === 'A+') return 'score-excellent';
        if (score === 'A') return 'score-good';
        if (score === 'B') return 'score-ok';
        return 'score-low';
    },

    _formatDate(timestamp) {
        if (!timestamp) return '';
        const d = new Date(timestamp);
        return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) + 
               ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }
};
