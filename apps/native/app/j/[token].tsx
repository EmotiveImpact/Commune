import { Redirect, useLocalSearchParams } from "expo-router";

/** https://app.ourcommune.io/j/<code>, the link a join QR carries, opened in the app. */
export default function ShortJoinLink() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <Redirect href={{ pathname: "/join-code/[token]", params: { token } }} />;
}
