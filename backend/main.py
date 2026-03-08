"""
ScholarAI Backend entry point.
Serves API routes: /api/chat, /api/plan, /api/upload.
"""
# TODO: FastAPI app, mount api routes, CORS, run uvicorn

def create_app():
    # from fastapi import FastAPI
    # app = FastAPI(title="ScholarAI API")
    # app.include_router(api.router, prefix="/api")
    # return app
    pass

if __name__ == "__main__":
    # uvicorn.run(create_app(), host="0.0.0.0", port=8000)
    print("Run: uvicorn main:create_app --reload")
