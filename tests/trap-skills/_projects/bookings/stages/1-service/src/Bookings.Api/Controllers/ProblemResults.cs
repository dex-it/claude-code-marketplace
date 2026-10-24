using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Bookings.Api.Controllers;

public static class ProblemResults
{
    public static ObjectResult ProblemWithCode(this ControllerBase controller, int status, string code, string title, string? detail = null)
    {
        var problem = controller.ProblemDetailsFactory.CreateProblemDetails(controller.HttpContext, status, title, detail: detail);
        problem.Extensions["code"] = code;
        return new ObjectResult(problem) { StatusCode = status, ContentTypes = { "application/problem+json" } };
    }

    public static ActionResult ValidationErrors(this ControllerBase controller, Dictionary<string, string[]> errors)
    {
        var modelState = new ModelStateDictionary();
        foreach (var (field, messages) in errors)
            foreach (var message in messages)
                modelState.AddModelError(field, message);

        return controller.ValidationProblem(modelState);
    }
}
