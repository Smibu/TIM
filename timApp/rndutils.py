"""
Functions to produce random lists.
For documentation, see: https://tim.jyu.fi/view/tim/ohjeita/satunnaistus
"""
import json
import numbers
import time
from random import Random
from typing import List, Dict, Tuple, Optional

MAX_RND_LIST_LEN = 100


def fix_jso(jso: str) -> str:
    """ If jso does not start with [ and two to make it list of lists."""
    if jso == '':
        return '[[1]]'
    if jso.startswith("["):
        return jso
    return '[[' + jso + ']]'


def sep_n_and_jso(jso: str) -> [int, str]:
    """
    Separates repeat factor and json string from string. Separator is * or :
    If no repeat factor, return just json string.
    For example:
        "3*7" -> 3, [[7]]
        "3"   -> -1, [[3]]
    :param jso: string to check
    :return: repeat factor and json-str that stands for a list
    """
    idx = jso.find(':')
    if idx < 0:
        idx = jso.find('*')
    if idx < 0:
        return -1, fix_jso(jso)  # means no repeat factor
    n = jso[:idx]
    jso = jso[idx+1:]
    try:
        n = int(n)
        if n < 0:
            n = 0
    except:
        n = -1
    n = min(n, MAX_RND_LIST_LEN)
    return n, fix_jso(jso)


def get_sample_list(myrandom: Random, jso: str) -> List[int]:
    """
    Returns a list of unique ints from the given interval.
    :param myrandom: random number generator
    :param jso: string to find the values
    :return: list of unique ints
    """
    idx = jso.find(':')
    if idx < 0:
        idx = jso.find('*')
    if idx < 0:
        n = jso
        jso = ''
    else:
        n = jso[:idx]
        jso = jso[idx+1:]
    try:
        n = int(n)
    except:
        n = 1
    n = min(n, MAX_RND_LIST_LEN)

    ret = []
    if len(jso) == 0:  # s10
        ints = list(range(0, n, 1))
        myrandom.shuffle(ints)
        return ints

    if not jso.startswith("["): # s10*50
        jso = "[" + jso + "]"

    r = json.loads(jso)

    if len(r) < 2:  # s10*[50]
        r.insert(0, 0)
    step = 1
    if len(r) > 2:
        step = r[2]

    if n == 1:  # handle s1: same as normal range
        ret = [myrandom.randrange(r[0], r[1] + 1, step)]
        return ret

    count = r[1] - r[0]
    if count > 500:
        raise ValueError(f'Too big range for s: {r[0]}-{r[1]}')
    ints = list(range(r[0], r[1] + 1, step))
    i = n
    while i >= len(ints):
        myrandom.shuffle(ints)
        ret.extend(ints)
        i -= len(ints)
    myrandom.shuffle(ints)
    ret.extend(ints[0:i])
    return ret


def get_int_list(myrandom: Random, jso: str) -> List[int]:
    """
    Returns list of random ints from given interval.
    :param myrandom: random number generator
    :param jso: string to find the values
    :return: list of random ints ints
    """
    ranges = json.loads(jso)
    if isinstance(ranges, int):  # only on item, rnd=6
        return [myrandom.randint(0, ranges)]
    ret = []
    for r in ranges:
        if isinstance(r, int):  # only on item, rnd=[6, 4]
            ret.append(myrandom.randint(0, r))
        else:
            if len(r) < 2:
                r.insert(0, 0)
            step = 1
            if len(r) > 2:
                step = r[2]
            ret.append(myrandom.randrange(r[0], r[1] + 1, step))
    return ret


def get_uniform_list(myrandom: Random, jso: str) -> List[float]:
    """
    Returns list of uniformely distributed random floats from given interval.
    :param myrandom: random number generator
    :param jso: string to find the values
    :return: list of random ints ints
    """
    ranges = json.loads(jso)
    if isinstance(ranges, numbers.Number):  # only on item, rnd=6
        return [myrandom.uniform(0, ranges)]
    ret = []
    for r in ranges:
        if isinstance(r, numbers.Number):  # only on item, rnd=[6, 4]
            ret.append(myrandom.uniform(0, r))
        else:
            if len(r) < 2:
                r.insert(0, 0)
            ret.append(myrandom.uniform(r[0], r[1]))
    return ret


def repeat_rnd(list_func, myrandom: Random, jso:str) -> Optional[List[int]]:
    """

    :param list_func: function to produce random list
    :param myrandom: random number generator
    :param jso: string to parse instructions
    :return: list of random numbers
    """
    n, jso = sep_n_and_jso(jso)
    if n == 0:
        return None
    rnds = list_func(myrandom, jso)
    lr = len(rnds)
    if n < 0:
        n = lr
    if lr >= n:
        return rnds[0:n]

    ret = rnds
    i = n - lr
    while i > lr:
        rnds = list_func(myrandom, jso)
        ret.extend(rnds)
        i -= lr
    ret.extend(rnds[0:i])
    return ret


def get_rnds(attrs: Dict, name: str ="rnd", rnd_seed: Optional[int]=None) -> Tuple[Optional[List[int]], int]:
    """
    Returns list of random numbers based on attribute name (def: rnd) and rnd_seed.
    :param attrs: dict of attributes
    :param name: name in attribute dict to use as instructions for the random numbers
    :param rnd_seed: random number initializion seed, if seed is None, use time
    :return: list of random numbers and used seed
    """
    if attrs is None:
        return None, rnd_seed
    rnd_seed = attrs.get('seed', rnd_seed)
    if rnd_seed is None:
        rnd_seed = time.clock()*1000

    # noinspection PyBroadException
    try:
        rnd_seed = int(rnd_seed)
    except:
        rnd_seed = int(time.clock()*1000)

    jso = attrs.get(name, None)
    if jso is None:
        return None, rnd_seed
    myrandom = Random()
    myrandom.seed(a=rnd_seed)

    if jso.startswith('s'):  # s10:[1,7,2], s10, s10:50, s10:[0,50]
        return get_sample_list(myrandom, jso[1:]), rnd_seed
    if jso.startswith('u'):  # u[[0,1],[100,110],[-30,-20],[0.001,0.002]], u6
        return repeat_rnd(get_uniform_list,myrandom, jso[1:]), rnd_seed

    ret = repeat_rnd(get_int_list, myrandom, jso)
    return ret, rnd_seed


def get_rands_as_dict(attrs: Dict, rnd_seed: int) -> Tuple[Optional[dict], int]:
    """
    Returns a dict of random numbers variables (each is a list of random numbers).
    :param attrs: dict where may be attrinute rndnames:"rnd1,rnd2,..,rndn".  Of no names, "rnd"
                  is assumed
    :param rnd_seed: seed to initialize the generator
    :return: dict of random variables
    """
    if attrs is None:
        return None, rnd_seed
    names = attrs.get('rndnames', 'rnd').split(',')
    ret = {}
    for name in names:
        rnds, rnd_seed = get_rnds(attrs, name, rnd_seed)
        if rnds is None:
            continue
        ret[name] = rnds
    if not ret:
        return None, rnd_seed
    ret['seed'] = rnd_seed
    return ret, rnd_seed


def get_rands_as_str(attrs: Dict, rnd_seed) -> Tuple[str, int]:
    """
    Returns a Jinja2 str of random numbers variables (each is a list of random numbers).
    :param attrs: dict where may be attrinute rndnames:"rnd1,rnd2,..,rndn".  Of no names, "rnd"
                  is assumed
    :param rnd_seed: seed to initialize the generator
    :return: Jinja 2 str of random variables
    """
    if attrs is None:
        return '', rnd_seed
    rands, rnd_seed = get_rands_as_dict(attrs, rnd_seed)
    if rands is None:
        return '', rnd_seed
    ret = '', rnd_seed
    for name, rnds in rands.items():
        if rnds is None:
            continue
        ret += '{% set ' + name + '=' + str(rnds) + ' %}\n'
    return ret, rnd_seed


def myhash(s: str) -> int:
    """
    Simple hash function to give always same hash for same input.
    :param s: string to hash
    :return: simple hash
    """
    csum = 0
    for c in s:
        csum += ord(c)
    return csum


def get_simple_hash_from_par_and_user(block, user) -> int:
    """
    Get simple int hash from TIM's document block and user.
    :param block: TIM's document block
    :param user: TIM user
    :return: simple hash that can be used for example as a seed for random number generator
    """
    h = str(block.get_id()) + str(block.get_doc_id())
    if user:
        h += user.name
    rnd_seed = myhash(h) & 0xffffffff
    return rnd_seed
