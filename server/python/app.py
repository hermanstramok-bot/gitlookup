from fastapi import FastAPI
from pydantic import BaseModel
import spacy

nlp = spacy.load("de_core_news_md")

app = FastAPI()

class TextRequest(BaseModel):
    text: str

@app.post("/analyze")
def analyze(req: TextRequest):
    doc = nlp(req.text)
    tokens = []

    for token in doc:
        full_lemma = token.lemma_
        prefix = None

        if token.pos_ in ("VERB", "AUX"):
            prefixes = [
                t.text.lower()
                for t in doc
                if t.dep_ == "svp" and t.head == token
            ]
            if prefixes:
                prefix = prefixes[0]
                full_lemma = prefix + token.lemma_

        tokens.append({
            "id": token.i,
            "text": token.text,
            "lemma": token.lemma_,
            "fullLemma": full_lemma,
            "prefix": prefix,
            "pos": token.pos_,
            "dep": token.dep_,
            "head": token.head.i,
            "isSeparableVerb": (
                token.pos_ in ("VERB", "AUX")
                and full_lemma != token.lemma_
            )
        })

    return {"tokens": tokens}