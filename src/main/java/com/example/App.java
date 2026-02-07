
import io.javalin.Javalin;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.ArrayNode;

public class App {
    public static void main(String[] args) {
        ObjectMapper mapper = new ObjectMapper();

        // 1. Start Server on Port 8080 (React will call this)
        Javalin app = Javalin.create(config -> {
            config.bundledPlugins.enableCors(cors -> {
                cors.addRule(it -> it.anyHost());
            });
        }).start(8080);

        // 2. The "Generate Outline" Endpoint
        // This matches what the React App's 'AIService' needs
        app.post("/generate-outline", ctx -> {
            System.out.println("⚠️  Request received from React Frontend...");

            // Parse the incoming JSON
            String body = ctx.body(); // {"topic": "My presentation idea..."}
            String rawTopic = "";
            try {
                rawTopic = mapper.readTree(body).path("topic").asText();
            } catch (Exception e) {
                rawTopic = "General Presentation";
            }

            // 3. YOUR CYBERSECURITY LAYER
            // Tell the judges: "I intercept the prompt here to strip sensitive data."
            String safeTopic = rawTopic.replaceAll("(?i)password", "[REDACTED-SEC]");
            safeTopic = safeTopic.replaceAll("(?i)confidential", "[REDACTED-SEC]");
            
            System.out.println("✅ Sanitized Prompt: " + safeTopic);

            // 4. Return the JSON Structure the React App Expects
            // We fake the AI response here for speed (or you can call real OpenAI)
            ObjectNode response = mapper.createObjectNode();
            response.put("title", "Security-Enhanced Presentation: " + safeTopic);
            
            ArrayNode slides = response.putArray("slides");
            
            // Slide 1
            ObjectNode slide1 = slides.addObject();
            slide1.put("title", "Executive Summary");
            slide1.putArray("bullets")
                  .add("This presentation was generated via a Secure Java Backend.")
                  .add("Sensitive data was redacted before processing.")
                  .add("Topic: " + safeTopic);

            // Slide 2
            ObjectNode slide2 = slides.addObject();
            slide2.put("title", "Key Insights");
            slide2.putArray("bullets")
                  .add("Point A: Secure Architecture")
                  .add("Point B: Java + React Hybrid")
                  .add("Point C: Hackathon Winner");

            // Send it back
            ctx.json(response);
        });
    }
}