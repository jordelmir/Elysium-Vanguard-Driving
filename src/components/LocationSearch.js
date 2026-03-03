import React, { useState } from 'react';
import {
    StyleSheet,
    View,
    TextInput,
    FlatList,
    Text,
    TouchableOpacity,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * LocationSearch - Motor de búsqueda optimizado para Costa Rica
 * Incluye scroll interno, búsqueda difusa y mejor visualización de resultados.
 */
const LocationSearch = ({ placeholder, onLocationSelect, icon, iconColor }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    const searchLocation = async (text) => {
        setQuery(text);
        if (text.length < 3) {
            setResults([]);
            return;
        }

        setLoading(true);
        try {
            // Usamos el API de Nominatim (OSM) filtrado por Costa Rica
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text + ', Costa Rica')}&addressdetails=1&limit=8`
            );
            const data = await response.json();
            setResults(data);
        } catch (error) {
            console.error('Error en búsqueda:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.inputContainer}>
                <Ionicons name={icon} size={18} color={iconColor} style={styles.icon} />
                <TextInput
                    style={styles.input}
                    placeholder={placeholder}
                    placeholderTextColor="#888"
                    value={query}
                    onChangeText={searchLocation}
                />
                {loading && <ActivityIndicator size="small" color="#FFF" />}
                {query.length > 0 && (
                    <TouchableOpacity onPress={() => { setQuery(''); setResults([]); }}>
                        <Ionicons name="close-circle" size={18} color="#888" />
                    </TouchableOpacity>
                )}
            </View>

            {results.length > 0 && (
                <View style={styles.resultsWrapper}>
                    <FlatList
                        data={results}
                        keyExtractor={(item) => item.place_id.toString()}
                        style={styles.resultsList}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.resultItem}
                                onPress={() => {
                                    setQuery(item.display_name.split(',')[0]);
                                    setResults([]);
                                    onLocationSelect(item);
                                }}
                            >
                                <Ionicons name="location-outline" size={20} color="#FFF" style={styles.resultIcon} />
                                <View style={styles.resultTextContainer}>
                                    <Text style={styles.resultTitle} numberOfLines={1}>
                                        {item.display_name.split(',')[0]}
                                    </Text>
                                    <Text style={styles.resultSubtitle} numberOfLines={1}>
                                        {item.display_name}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        zIndex: 100,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 50,
    },
    icon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        color: '#FFF',
        fontSize: 15,
    },
    resultsWrapper: {
        position: 'absolute',
        top: 55,
        left: 0,
        right: 0,
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        maxHeight: 250, // Scroll forzado
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    resultsList: {
        padding: 5,
    },
    resultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    resultIcon: {
        marginRight: 12,
    },
    resultTextContainer: {
        flex: 1,
    },
    resultTitle: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    resultSubtitle: {
        color: '#AAA',
        fontSize: 12,
        marginTop: 2,
    }
});

export default LocationSearch;
