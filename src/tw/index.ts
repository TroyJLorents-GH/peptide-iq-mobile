// className-enabled React Native primitives (react-native-css wraps RN
// components so Tailwind classes resolve on native). Import UI building
// blocks from here instead of 'react-native'.
export {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native-css/components';
export { useCssElement, useNativeVariable } from 'react-native-css';
