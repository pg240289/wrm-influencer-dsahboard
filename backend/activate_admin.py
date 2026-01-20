"""
Script to activate the admin account in the database.
Run this if the admin account is deactivated.
"""
from app import app, db, User, Role

with app.app_context():
    # Find admin user
    admin_user = User.query.filter_by(username='admin').first()
    
    if admin_user:
        # Activate admin account
        admin_user.is_active = True
        
        # Ensure admin has Admin role
        admin_role = Role.query.filter_by(name='Admin').first()
        if admin_role:
            if admin_role not in admin_user.roles:
                admin_user.roles.append(admin_role)
        
        db.session.commit()
        print("✅ Admin account activated successfully!")
        print(f"   Username: {admin_user.username}")
        print(f"   Email: {admin_user.email}")
        print(f"   Active: {admin_user.is_active}")
        print(f"   Roles: {[r.name for r in admin_user.roles]}")
    else:
        print("❌ Admin user not found. Please run init_db() first.")

