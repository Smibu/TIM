"""Routes for searching."""
from flask import Blueprint, render_template

from options import get_option
from routes.sessioninfo import get_current_user_object
from .cache import cache
from .common import *

search_routes = Blueprint('search',
                          __name__,
                          url_prefix='/search')


def make_cache_key(*args, **kwargs):
    path = request.path
    return (str(get_current_user_id()) + path).encode('utf-8')


@search_routes.route('/<query>')
@cache.cached(key_prefix=make_cache_key)
def search(query):
    if len(query.strip()) < 3:
        abort(400, 'Search text must be at least 3 characters long with whitespace stripped.')
    timdb = get_timdb()
    viewable = timdb.users.get_viewable_blocks(get_current_user_id())
    docs = timdb.documents.get_documents(filter_ids=viewable)
    current_user = get_current_user_object()
    all_texts = []
    all_js = []
    all_css = []
    all_modules = []
    for d in docs:
        doc = d.document
        pars = doc.get_paragraphs()
        found_pars = []
        for t in pars:
            if query.lower() in t.get_markdown().lower():
                found_pars.append(t)
        if not found_pars:
            continue
        DocParagraph.preload_htmls(pars, doc.get_settings())
        pars, js_paths, css_paths, modules = post_process_pars(doc,
                                                               found_pars,
                                                               current_user if logged_in() else None,
                                                               sanitize=False,
                                                               do_lazy=get_option(request, "lazy", True),
                                                               load_plugin_states=False)
        all_texts.extend(pars)
        for j in js_paths:
            all_js.append(j)
        for c in css_paths:
            all_css.append(c)
        for m in modules:
            all_modules.append(m)
        if len(all_texts) > 500:
            break
    for t in all_texts:
        t['attrs']['rl'] = 'force'
        t['ref_doc_id'] = t['doc_id']
        t['ref_id'] = t['id']
    return render_template('view_html.html',
                           route='search',
                           doc={'id': -1, 'name': 'Search results', 'fullname': 'Search results',
                                'title': 'Search results'},
                           text=all_texts,
                           js=all_js,
                           cssFiles=all_css,
                           jsMods=all_modules,
                           group=get_current_user_group(),
                           rights={'editable': False,
                                   'can_mark_as_read': False,
                                   'can_comment': False,
                                   'browse_own_answers': False,
                                   'teacher': False,
                                   'see_answers': False,
                                   'manage': False
                                   },
                           reqs=pluginControl.get_all_reqs(),
                           settings=get_user_settings(),
                           version={'hash': None},
                           translations=None,
                           start_index=None,
                           in_lecture=False,
                           disable_read_markings=True,
                           no_browser=get_option(request, "noanswers", False))
