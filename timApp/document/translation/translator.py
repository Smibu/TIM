from dataclasses import dataclass
from subprocess import run as run_subprocess
from json import loads as json_loads
import requests


@dataclass
class Usage:
    character_count: int
    character_limit: int


class ITranslator:
    def translate(self, text: list[str], src_lang: str, target_lang: str) -> str:
        raise NotImplementedError

    def usage(self) -> Usage:
        raise NotImplementedError


@dataclass
class DeepLTranslator(ITranslator):
    api_key: str
    url: str = "https://api-free.deepl.com/v2"

    def __post_init__(self) -> None:
        self.headers = {"Authorization": f"DeepL-Auth-Key {self.api_key}"}

    def translate(self, text: list[str], source_lang: str, target_lang: str) -> str:
        """
        Uses the DeepL API for translating text between languages
        :param text: Text to be translated
        :param source_lang: DeepL-compliant language code of input text
        :param target_lang: DeepL-compliant language code for target language
        :return: The input text translated into the target language
        """
        # TODO Limit the amount of `text` parameters according to DeepL spec (50 per request?)
        data = {
            "text": text,
            "source_lang": source_lang,
            "target_lang": target_lang,
        }
        resp = requests.post(self.url + "/translate", data=data, headers=self.headers)

        # TODO Handle the various HTTP error codes that API can return
        if resp.ok:
            try:
                # TODO Use a special structure to insert the text-parts sent to the API into correct places in original text
                return "".join([tr["text"] for tr in resp.json()["translations"]])
            except requests.exceptions.JSONDecodeError as e:
                raise Exception(f"DeepL API returned malformed JSON: {e}")
        else:
            raise Exception(f"DeepL API / Translate responded with {resp.status_code}")

    def usage(self) -> Usage:
        resp = requests.post(self.url + "/usage", headers=self.headers)
        if resp.ok:
            try:
                resp_json = resp.json()
                return Usage(
                    character_count=int(resp_json["character_count"]),
                    character_limit=int(resp_json["character_limit"]),
                )
            except requests.exceptions.JSONDecodeError as e:
                raise Exception(f"DeepL API returned malformed JSON: {e}")
        else:
            raise Exception(f"DeepL API / Usage responded with {resp.status_code}")
