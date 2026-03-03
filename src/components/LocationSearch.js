import React, { useState, useCallback, useRef } from 'react';
import {
    StyleSheet,
    View,
    TextInput,
    FlatList,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import debounce from 'lodash.debounce';

const { height, width } = Dimensions.get('window');

/**
 * LocationSearch - Motor de búsqueda ELITE L7
 * Implementa Throttling, Dropdown Opaco Profesional y Scroll Infinito.
 */
const LocationSearch = ({ placeholder, onLocationSelect, icon, iconColor, onFocus }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    // Referencia para evitar cierres accidentales
    const flatListRef = useRef(null);

    // Búsqueda con Throttling (300ms)
    const debouncedSearch = useCallback(
        debounce(async (text, pageNum = 1) => {
            if (text.length < 3) return;

            setLoading(true);
            try {
                const offset = (pageNum - 1) * 10;
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text + ', Costa Rica')}&addressdetails=1&limit=10&offset=${offset}`
                );
                const data = await response.json();

                if (pageNum === 1) {
                    setResults(data);
                } else {
                    setResults(prev => [...prev, ...data]);
                }

                setHasMore(data.length === 10);
            } catch (error) {
                console.error('Error en búsqueda elite:', error);
            } finally {
                setLoading(false);
            }
        }, 300),
        []
    );

    const handleTextChange = (text) => {
        setQuery(text);
        setPage(1);
        if (text.length >= 3) {
            debouncedSearch(text, 1);
        } else {
            setResults([]);
        }
    };

    const loadMore = () => {
        if (!loading && hasMore && query.length >= 3) {
            const nextPage = page + 1;
            setPage(nextPage);
            debouncedSearch(query, nextPage);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.inputContainer}>
                <Ionicons name={icon} size={20} color={iconColor} style={styles.icon} />
                <TextInput
                    style={styles.input}
                    placeholder={placeholder}
                    placeholderTextColor="#666"
                    value={query}
                    onChangeText={handleTextChange}
                    onFocus={onFocus}
                    autoCorrect={false}
                />
                {loading && page === 1 && <ActivityIndicator size="small" color="#FFD600" />}
                {query.length > 0 && !loading && (
                    <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
                        <Ionicons name="close-circle" size={20} color="#666" />
                    </TouchableOpacity>
                )}
            </View>

            {results.length > 0 && (
                <View style={styles.resultsOverlay}>
                    <Text style={styles.resultsHeader}>RECOMENDACIONES EN COSTA RICA</Text>
                    <FlatList
                        ref={flatListRef}
                        data={results}
                        keyExtractor={(item, index) => `${item.place_id}-${index}`}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.resultItem}
                                onPress={() => {
                                    setQuery(item.display_name.split(',')[0]);
                                    setResults([]);
                                    onLocationSelect(item);
                                }}
                            >
                                <View style={styles.locationIconCircle}>
                                    <Ionicons name="navigate" size={18} color="#FFD600" />
                                </View>
                                <View style={styles.resultTextContainer}>
                                    <Text style={styles.resultTitle} numberOfLines={1}>
                                        {item.display_name.split(',')[0]}
                                    </Text>
                                    <Text style={styles.resultSubtitle} numberOfLines={1}>
                                        {item.display_name}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color="#333" />
                            </TouchableOpacity>
                        )}
                        onEndReached={loadMore}
                        onEndReachedThreshold={0.8} // Carga al llegar al 80%
                        ListFooterComponent={loading && page > 1 ? <ActivityIndicator style={{ margin: 20 }} color="#FFD600" /> : null}
                        keyboardShouldPersistTaps="always"
                    />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        zIndex: 2000,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#000',
        borderRadius: 12,
        paddingHorizontal: 15,
        height: 55, // 15% más grande según pedido
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    icon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: '#FFF',
        fontSize: 16,
        fontWeight: '500',
    },
    resultsOverlay: {
        position: 'absolute',
        top: 65,
        left: -15, // Compensa el padding del contenedor superior
        right: -15,
        width: width,
        height: height * 0.8, // Dropdown profesional que cubre casi todo el mapa
        backgroundColor: '#0A0A0A',
        zIndex: 5000,
        paddingTop: 10,
    },
    resultsHeader: {
        color: '#FFD600',
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 2,
        marginLeft: 20,
        marginBottom: 10,
        opacity: 0.8,
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.03)',
    },
    locationIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,214,0,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    resultTextContainer: {
        flex: 1,
    },
    resultTitle: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '600',
    },
    resultSubtitle: {
        color: '#666',
        fontSize: 13,
        marginTop: 2,
    }
});

export default LocationSearch;
