from enum import Enum, unique
from timApp.timdb.sqa import db


@unique
class TagType(Enum):
    """Type for a Tag."""
    Regular = 1
    """A regular tag."""

    CourseCode = 2
    """The Tag is a course code."""

    Subject = 3
    """The Tag is the name for a subject."""

    def to_json(self):
        return self.value


class Tag(db.Model):
    """A tag with associated document id, tag name, type and expiration date."""
    __bind_key__ = 'tim_main'
    __tablename__ = 'tag'
    block_id = db.Column(db.Integer, db.ForeignKey('block.id'), primary_key=True)
    name = db.Column(db.Text, primary_key=True)
    type = db.Column(db.Enum(TagType), nullable=False)
    expires = db.Column(db.DateTime(timezone=True))

    block = db.relationship('Block', back_populates='tags')

    def __json__(self):
        return ['block_id', 'name', 'type', 'expires']

    @property
    def has_tag_special_chars(self):
        """
        Checks whether the tag name has characters other than (lower or upper case) a-ö,
        numbers 0-9, slashes, underscores or spaces.
        characters.
        :return:
        """
        return set(self.name.lower()) - set('abcdefghijklmnopqrstuvwxyzåäö0123456789/- _')
