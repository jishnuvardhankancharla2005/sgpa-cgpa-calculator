import json
from app import app

def test_mongo_layer():
    with app.app_context():
        mongo_db = app.config.get("MONGO_DB")
        if mongo_db is not None:
            print("MongoDB Atlas is connected!")
            # Test inserting dummy student
            user_doc = {"username": "mongostudent", "password_hash": "test", "name": "Mongo Student", "role": "student"}
            mongo_db.users.update_one({"username": "mongostudent"}, {"$set": user_doc}, upsert=True)
            saved_user = mongo_db.users.find_one({"username": "mongostudent"})
            assert saved_user["name"] == "Mongo Student"
            print("MongoDB User collection verified!")
        else:
            print("MongoDB Atlas URI not set in env yet. App ready for MONGODB_URI.")

if __name__ == "__main__":
    test_mongo_layer()
