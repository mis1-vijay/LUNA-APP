import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type SearchBarProps = {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
};

export default function SearchBar({
  placeholder = 'Search resources',
  value,
  onChangeText,
}: SearchBarProps) {
  return (
    <View style={styles.container}>
      <Ionicons name="search-outline" size={16} color="#64748b" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#64748b"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  input: {
    flex: 1,
    marginLeft: 8,
    color: '#0f172a',
    fontSize: 14,
  },
});
