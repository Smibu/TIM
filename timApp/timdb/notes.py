from contracts import contract
from timdb.timdbbase import TimDbBase

class Notes(TimDbBase):
    @contract
    def __init__(self, db_path : 'Connection', files_root_path : 'str', type_name : 'str', current_user_name : 'str'):
        """Initializes TimDB with the specified database and root path.
        
        :param db_path: The path of the database file.
        :param files_root_path: The root path where all the files will be stored.
        """
        TimDbBase.__init__(self, db_path, files_root_path, type_name, current_user_name)
        #self.ec = EphemeralClient(EPHEMERAL_URL)
    
    @contract
    def __tagstostr(self, tags : 'list(str)') -> 'str':
        tagstr = ''
        if 'difficult' in tags:
            tagstr += 'd'
        if 'unclear' in tags:
            tagstr += 'u'
        return tagstr
                
    @contract
    def __strtotags(self, tagstr : 'str') -> 'list(str)':
        tags = []
        if 'd' in tagstr:
            tags.append("difficult")
        if 'u' in tagstr:
            tags.append("unclear")
        return tags
                
    @contract
    def hasEditAccess(self, user_id : 'int', doc_id : 'int', par_index : 'int', note_index : 'int') -> 'bool':
        """
        :param user_id: The owner of the note.
        :param doc_id: The document in which the note resides.
        :param par_index: The paragraph index.
        :param note_index: The note index, starting from 0 for each paragraph.
        """
        cursor = self.db.cursor()
    
        cursor.execute(
        """
            select user_id from UserNotes
            where doc_id = ? and par_index = ? and note_index = ?
        """, [doc_id, par_index, note_index])
        row = cursor.fetchone()
        return row is not None and int(row[0]) == user_id
    
    @contract
    def addNote(self, user_id : 'int', group_id : 'int', doc_id : 'int', doc_ver : 'str', par_index : 'int', content : 'str', access : 'str', tags : 'list(str)', commit : 'bool' = True):
        """Adds a note to the document.
        
        :param user_id: The user who owns the note.
        :param group_id: The user group who owns the note.
        :param doc_id: The document in which the note exists.
        :param doc_ver: The version of the document.
        :param par_index: Index of the paragraph which the note is for.
        :param content: The content of the note.
        :param access: Who can read the note.
        :param tags: Tags for the note (difficult, unclear).
        """
        self.addEmptyParMapping(doc_id, doc_ver, par_index, commit=False)
        cursor = self.db.cursor()
    
        cursor.execute(
        """
            select note_index from UserNotes
            where user_id = ? and doc_id = ? and par_index = ?
            order by note_index desc
        """, [user_id, doc_id, par_index])
        
        lastindex = cursor.fetchone()
        if lastindex is None:
            note_index = 0
        else:
            note_index = int(lastindex[0]) + 1
        
        cursor.execute(
        """
            insert into UserNotes
            (user_id, group_id, doc_id, doc_ver, par_index, note_index,
            content, created, modified, access, tags)
            values (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, NULL, ?, ?)
        """, [user_id, group_id, doc_id, doc_ver, par_index, note_index,
        content, access, self.__tagstostr(tags)])

        if commit:
            self.db.commit()

    @contract
    def modifyNote(self, user_id: 'int', doc_id : 'int', doc_ver : 'str', par_index : 'int', note_index : 'int', new_content : 'str', new_tags : 'list(str)'):
        """Modifies an existing note.
        
        :param user_id: The owner of the note.
        :param doc_id: The document in which the note resides.
        :param par_index: The paragraph index.
        :param note_index: The note index, starting from 0 for each paragraph.
        :param new_content: New note text to set.
        :param new_tags: New tags to set.
        """
        cursor = self.db.cursor()
        
        cursor.execute(
        """
            update UserNotes
            set doc_ver = ?, content = ?, tags = ?
            where user_id = ? and doc_id = ? and par_index = ? and note_index = ?
        """, [doc_ver, new_content, self.__tagstostr(new_tags),
              user_id, doc_id, par_index, note_index])
        
        self.db.commit()

    @contract
    def deleteNote(self, user_id: 'int', doc_id : 'int', par_index : 'int', note_index : 'int'):
        """Deletes a note.
        
        :param user_id: The owner of the note.
        :param doc_id: The document in which the note resides.
        :param par_index: The paragraph index.
        :param note_index: The note index, starting from 0 for each paragraph.
        """
        cursor = self.db.cursor()
        
        cursor.execute(
        """
            delete from UserNotes
            where user_id = ? and doc_id = ? and par_index = ? and note_index = ?
        """, [user_id, doc_id, par_index, note_index])
        
        self.db.commit()
        
    @contract
    def getNotes(self, user_id : 'int', group_id : 'int', doc_id : 'int', doc_ver : 'str') -> 'list(dict)':
        """Gets all notes for a document a particular user has access to.
        :param user_id: The user requesting the notes.
        :param group_id: The group of the user.
        :param doc_id: The document to get the notes for.
        """
        #cursor = self.db.cursor()

        result = self.getMappedValues(
            user_id, doc_id, doc_ver, 'UserNotes',
            extra_fields=['user_id', 'note_index', 'content', 'created', 'modified', 'tags']
        )

        # cursor.execute(
        # """
        #     select user_id, par_index, note_index, content, created, modified, tags
        #     from UserNotes
        #     where doc_id  = ? and (user_id = ? or access = 'group' and group_id = ? or access = 'everyone')
        # """, [doc_id, user_id, group_id])
        
        #result = self.resultAsDictionary(cursor)

        for item in result:
            item["tags"] = self.__strtotags(item["tags"])
        
        return result
