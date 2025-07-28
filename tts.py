import os
from dotenv import load_dotenv
from huggingface_hub import InferenceClient

load_dotenv()  # This loads the .env file

client = InferenceClient(
    provider="auto",
    api_key=os.environ["HF_TOKEN"],
)

# audio is returned as bytes
audio = client.text_to_speech(
    "The answer to the universe is 42",
    model="hexgrad/Kokoro-82M",
)

# Optionally, save the audio to a file
with open("output.wav", "wb") as f:
    f.write(audio)