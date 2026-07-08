import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useState } from "react";
import { Image as ImageIcon, Smile } from "lucide-react-native";
import { ScreenHeader } from "../components/ScreenHeader";
import { Button } from "../components/Button";

const MAX_LENGTH = 280;

export default function CreateScreen() {
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);

  const handlePost = () => {
    if (!content.trim()) return;
    setPosting(true);
    // TODO: call POST /api/posts when the API is wired up
    setTimeout(() => {
      setPosting(false);
      setContent("");
    }, 800);
  };

  const remaining = MAX_LENGTH - content.length;
  const nearLimit = remaining <= 30;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScreenHeader title="Create" subtitle="Share what's on your mind" />

      <View className="flex-1 px-5 pt-4">
        <TextInput
          value={content}
          onChangeText={(text) => setContent(text.slice(0, MAX_LENGTH))}
          placeholder="What's happening on campus?"
          placeholderTextColor="#9CA3AF"
          multiline
          className="flex-1 text-textPrimary"
          style={{ fontSize: 16, lineHeight: 24, textAlignVertical: "top" }}
        />

        {/* Bottom toolbar */}
        <View
          className="flex-row items-center justify-between border-t border-border pt-3 pb-2"
        >
          <View className="flex-row items-center gap-5">
            <ImageIcon size={22} color="#1A6B3C" />
            <Smile size={22} color="#1A6B3C" />
          </View>

          <View className="flex-row items-center gap-4">
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: nearLimit ? "#EF4444" : "#9CA3AF",
              }}
            >
              {remaining}
            </Text>
            <Button
              label="Post"
              size="sm"
              onPress={handlePost}
              loading={posting}
              disabled={!content.trim()}
              className="px-5"
            />
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}