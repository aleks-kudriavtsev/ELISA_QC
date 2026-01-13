class User {
  constructor({ id, email, displayName, role, createdAt }) {
    this.id = id;
    this.email = email;
    this.displayName = displayName;
    this.role = role;
    this.createdAt = createdAt;
  }
}

module.exports = { User };
