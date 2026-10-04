namespace Aqualab.Samples;

public enum SampleStatus { Planned, Collected, InAnalysis, Done }

public class Site
{
    public int Id { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public string TimeZoneId { get; set; } = "Europe/Moscow";
}

public class Sample
{
    public int Id { get; set; }
    public string LabCode { get; set; } = "";
    public int SiteId { get; set; }
    public Site Site { get; set; } = null!;
    public SampleStatus Status { get; set; }

    // Плановое время отбора по местным часам объекта (так его видит пробоотборщик в графике).
    public DateTime PlannedLocal { get; set; }
    public DateTime? CollectedAt { get; set; }

    public int? BatchId { get; set; }
    public Batch? Batch { get; set; }

    public List<SampleTag> Tags { get; set; } = new();
    public List<Result> Results { get; set; } = new();
}

public class SampleTag
{
    public int Id { get; set; }
    public int SampleId { get; set; }
    public string Tag { get; set; } = "";
}

public class Result
{
    public int Id { get; set; }
    public int SampleId { get; set; }
    public string Parameter { get; set; } = "";
    public decimal Value { get; set; }
    public decimal Limit { get; set; }
}

public class Batch
{
    public int Id { get; set; }
    public string Number { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime? ClosedAt { get; set; }
    public DateTime? ReportDate { get; set; }
    public List<Sample> Samples { get; set; } = new();
    public List<BatchInstrument> Instruments { get; set; } = new();
}

public class BatchInstrument
{
    public int Id { get; set; }
    public int BatchId { get; set; }
    public string InstrumentCode { get; set; } = "";
    public string Operator { get; set; } = "";
}
