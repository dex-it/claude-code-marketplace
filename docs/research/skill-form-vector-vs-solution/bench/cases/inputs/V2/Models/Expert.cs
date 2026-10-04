namespace GrantDesk.Models;

/// <summary>Эксперт фонда. Id совпадает с идентификатором пользователя.</summary>
public class Expert
{
    public string Id { get; set; } = "";
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";

    /// <summary>
    /// ИНН организации - основного места работы эксперта. По положению о конкурсе (п. 4.3) эксперт не
    /// оценивает заявки, поданные им лично или организацией, в которой он работает.
    /// </summary>
    public string OrganizationInn { get; set; } = "";

    public bool Active { get; set; } = true;
}
