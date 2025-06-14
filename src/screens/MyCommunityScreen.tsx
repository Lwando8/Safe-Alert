import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MyCommunityScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>My Community screen will be coming soon.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    fontSize: 18,
    color: '#888',
  },
});

export default MyCommunityScreen;