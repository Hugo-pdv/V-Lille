document.addEventListener('DOMContentLoaded', () => {
    const getStationColor = (station) => {
        if (station.etat !== 'EN SERVICE') return '#808080';
        if (station.nb_velos_dispo === 0) return '#f44336';
        if (station.nb_velos_dispo < 5) return '#FFA500';
        return '#4CAF50';
    };

    // Configuration de la carte
    const map = L.map('map', {
        zoomControl: false,
        tap: true,
        touchZoom: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors, © CARTO',
        maxZoom: 19
    }).addTo(map);

    // Configuration des filtres
    const createFilterControl = () => {
        const filters = L.control({ position: 'topleft' });
        
        filters.onAdd = (map) => {
            const div = L.DomUtil.create('div', 'info filters');
            const filterConfig = [
                { id: 'available', color: '#4CAF50', label: 'Disponible' },
                { id: 'few', color: '#FFA500', label: 'Peu de vélos' },
                { id: 'empty', color: '#f44336', label: 'Aucun vélo' },
                { id: 'inactive', color: '#808080', label: 'Hors service' }
            ];

            div.innerHTML = `
                <div class="filters-title">Filtres</div>
                ${filterConfig.map(filter => `
                    <div class="filter-item">
                        <input type="checkbox" id="filter-${filter.id}" checked>
                        <label for="filter-${filter.id}">
                            <span class="filter-color" style="background: ${filter.color}"></span>
                            ${filter.label}
                        </label>
                    </div>
                `).join('')}
            `;

            div.addEventListener('mousedown', e => e.stopPropagation());
            return div;
        };

        return filters;
    };

    createFilterControl().addTo(map);

    // Gestion des stations
    const createStationPopup = (station, isMobile) => {
        return `
            <div class="custom-popup">
                <h3>${station.nom}</h3>
                <p class="address">${station.adresse}</p>
                <div class="stats">
                    <div class="stat-item">
                        <span class="stat-value">${station.nb_velos_dispo}</span>
                        <span class="stat-label">Vélos</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${station.nb_places_dispo}</span>
                        <span class="stat-label">Places</span>
                    </div>
                </div>
                <div class="status ${station.etat === 'EN SERVICE' ? 'active' : 'inactive'}">
                    ${station.etat}
                </div>
                <div class="update-time">
                    Mise à jour : ${new Date(station.date_modification).toLocaleString()}
                </div>
            </div>
        `;
    };

    const shouldDisplayStation = (station) => {
        const isInactive = station.etat !== 'EN SERVICE' && document.getElementById('filter-inactive').checked;
        const isActive = station.etat === 'EN SERVICE' && (
            (station.nb_velos_dispo === 0 && document.getElementById('filter-empty').checked) ||
            (station.nb_velos_dispo < 5 && station.nb_velos_dispo > 0 && document.getElementById('filter-few').checked) ||
            (station.nb_velos_dispo >= 5 && document.getElementById('filter-available').checked)
        );
        return isInactive || isActive;
    };

    const createStationMarker = (station, isMobile) => {
        const marker = L.circleMarker([station.y, station.x], {
            radius: isMobile ? 8 : 10,
            fillColor: getStationColor(station),
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        });

        marker.bindPopup(createStationPopup(station, isMobile), {
            autoPan: true,
            autoPanPadding: [10, 10],
            maxWidth: isMobile ? 280 : 300
        });

        return marker;
    };

    async function loadStations() {
        try {
            map.eachLayer(layer => {
                if (layer instanceof L.CircleMarker) map.removeLayer(layer);
            });

            const response = await fetch('data.json');
            const { velos: stations } = await response.json();
            const isMobile = window.innerWidth <= 768;

            stations
                .filter(shouldDisplayStation)
                .forEach(station => createStationMarker(station, isMobile).addTo(map));

            if (isMobile) {
                map.on('click', () => map.closePopup());
            }
        } catch (error) {
            console.error('Erreur lors du chargement des stations:', error);
        }
    }

    // Initialisation
    async function initMap() {
        try {
            const response = await fetch('data.json');
            const { velos: stations } = await response.json();
            
            const bounds = L.latLngBounds(stations.map(s => [s.y, s.x]));
            map.fitBounds(bounds, {
                padding: [50, 50],
                maxZoom: 13
            });
        } catch (error) {
            console.error('Erreur lors de l\'initialisation:', error);
            map.setView([50.63297, 3.057520], 13);
        }
    }

    // Démarrage de l'application
    initMap().then(() => {
        loadStations();
        setInterval(loadStations, 30000);
    });

    // Gestion des événements
    ['available', 'few', 'empty', 'inactive'].forEach(id => {
        document.getElementById(`filter-${id}`).addEventListener('change', loadStations);
    });

    window.addEventListener('resize', () => {
        if ((window.innerWidth <= 768) !== (window.innerWidth <= 768)) {
            location.reload();
        }
    });
});