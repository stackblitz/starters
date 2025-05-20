import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function Index() {
  const router = useRouter();
  
  useEffect(() => {
    setTimeout(() => {
      //@ts-ignore
      router.replace('/(tabs)');
    }, 0);
  }, []);
  
  // Return an empty view while we're redirecting
  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});